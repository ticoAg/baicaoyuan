package io.github.ticoag.baicaoyuan

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File

private const val HOST = "plants.ticoag.fun"
private const val HOME = "https://$HOST/"

// 百草园的 Android 外壳：全屏打开 plants.ticoag.fun。
// 站内页面留在应用里，外站链接和电话交给系统；断网时能看哪些页，由网站自己的 service worker 决定。
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private lateinit var offline: View
    private var failed = false
    private var failedUrl: String? = null

    // 网页里 <input type="file"> 在等的回调；相机要写入的文件
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var photo: File? = null

    private val back = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() = web.goBack()
    }

    private val pick = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        fileCallback?.onReceiveValue(if (result.resultCode == RESULT_OK) picked(result.data) else null)
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        web = findViewById(R.id.web)
        offline = findViewById(R.id.offline)
        if (savedInstanceState == null) File(cacheDir, "photos").deleteRecursively()

        // 状态栏、导航栏、刘海和键盘占的地方不放网页
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content)) { v, insets ->
            val types = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
            val bars = insets.getInsets(types)
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            userAgentString = "$userAgentString Baicaoyuan/${BuildConfig.VERSION_NAME}"
        }
        web.setBackgroundColor(getColor(R.color.paper))
        web.webViewClient = Client()
        web.webChromeClient = Chrome()
        web.setDownloadListener { url, _, _, _, _ -> open(url.toUri()) }
        onBackPressedDispatcher.addCallback(this, back)
        findViewById<View>(R.id.retry).setOnClickListener { failedUrl?.let(web::loadUrl) ?: web.reload() }

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(intent.data?.takeIf(::isSite)?.toString() ?: HOME)
        }
        back.isEnabled = web.canGoBack()
    }

    // 启动器快捷方式、别的应用传来的本站链接
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.data?.takeIf(::isSite)?.let { web.loadUrl(it.toString()) }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        web.destroy()
        super.onDestroy()
    }

    private fun isSite(uri: Uri) = uri.scheme == "https" && uri.host == HOST

    private fun open(uri: Uri) {
        val intent = when (uri.scheme) {
            "tel" -> Intent(Intent.ACTION_DIAL, uri)
            else -> Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
        }
        try {
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app, Toast.LENGTH_SHORT).show()
        }
    }

    // 选图返回一张或几张；拍照时多数相机不返回地址，照片在 photo 里
    private fun picked(data: Intent?): Array<Uri>? {
        val clip = data?.clipData
        val uris = when {
            clip != null -> (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
            data?.data != null -> listOf(data.data!!)
            else -> emptyList()
        }
        if (uris.isNotEmpty()) return uris.toTypedArray()
        val file = photo?.takeIf { it.length() > 0 } ?: return null
        return arrayOf(FileProvider.getUriForFile(this, "$packageName.files", file))
    }

    private fun cameraIntent(): Intent {
        val file = File(File(cacheDir, "photos").apply { mkdirs() }, "${System.currentTimeMillis()}.jpg")
        photo = file
        return Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            .putExtra(MediaStore.EXTRA_OUTPUT, FileProvider.getUriForFile(this, "$packageName.files", file))
            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (!request.isForMainFrame || isSite(request.url)) return false
            open(request.url)
            return true
        }

        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            failed = false
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame) return
            failed = true
            failedUrl = request.url.toString()
            offline.visibility = View.VISIBLE
        }

        override fun onPageFinished(view: WebView, url: String) {
            if (!failed) offline.visibility = View.GONE
        }

        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
            back.isEnabled = view.canGoBack()
        }
    }

    private inner class Chrome : WebChromeClient() {
        // 拍照识别页的 <input type="file" accept="image/*" multiple>：选图或拍照
        override fun onShowFileChooser(
            view: WebView,
            callback: ValueCallback<Array<Uri>>,
            params: FileChooserParams,
        ): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = callback
            val content = params.createIntent()
            if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) content.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            val chooser = Intent.createChooser(content, null)
            if (params.acceptTypes.any { it.startsWith("image/") }) {
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent()))
            }
            return try {
                pick.launch(chooser)
                true
            } catch (_: ActivityNotFoundException) {
                fileCallback = null
                false
            }
        }
    }
}
