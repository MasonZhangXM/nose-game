import http.server
import socketserver
import mimetypes
import socket
from urllib.parse import urlparse

# ---------------------------------------------------------
# 这是一个简单的游戏服务器脚本
# 作用：把你的电脑变成一个“网站服务器”，这样你就可以在浏览器里玩游戏了。
# 为什么需要它：直接双击 html 文件打开，很多功能（比如摄像头、AI模型加载）会被浏览器
# 的安全策略拦截。用这个服务器运行，能模拟真实的网站环境，避开这些限制。
# ---------------------------------------------------------

# 服务器的“门牌号”（端口）
# 如果这个端口被占用了（报错 Address already in use），可以改个数字，比如 3006
PORT = 3005

# 1. 告诉浏览器如何处理特殊文件
# 就像去餐厅点菜，服务员得知道 ".wasm" 是什么菜，不然会当成乱码上桌。
mimetypes.add_type('application/wasm', '.wasm')         # AI模型的核心计算代码
mimetypes.add_type('application/javascript', '.js')     # 游戏逻辑代码
mimetypes.add_type('application/octet-stream', '.tflite') # AI模型的数据文件

# 2. 自定义服务员的行为
class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        """
        处理“获取文件”的请求 (GET Request)
        每当浏览器想加载一个图片、脚本或网页时，都会调用这个函数。
        """
        # 解析请求的路径
        parsed = urlparse(self.path)
        path = parsed.path
        
        # 忽略开发工具特有的请求（避免后台报错吓到人）
        if path == '/@vite/client':
            self.send_response(204)  # 204表示“知道了，没内容，别报错”
            self.end_headers()
            return

        # 调用父类的方法，真正去硬盘里找文件并发送给浏览器
        return super().do_GET()

    def end_headers(self):
        """
        在发送文件内容之前，先贴上一些“标签”（HTTP Headers）
        """
        # 允许跨域：允许不同来源的网页访问这个服务器（方便调试）
        self.send_header('Access-Control-Allow-Origin', '*')
        
        # 禁止缓存：告诉浏览器“每次都从服务器拿最新的文件，不要存旧的”
        # 为什么这么做：你在改代码时，肯定希望刷新浏览器就能看到最新效果，
        # 而不是因为浏览器偷懒用了旧缓存，导致你以为代码没改好。
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        
        super().end_headers()

# 3. 雇佣“多线程”服务员
# 普通服务器一次只能接待一个客人（请求）。
# 多线程服务器可以同时接待多个，这样加载大量图片或模型时会更快，不会卡顿。
class ThreadingHTTPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True # 允许快速重启服务器，不用等端口释放

Handler = CustomHandler

# 获取本机的局域网 IP 地址
# 这样你就可以发给同一 WiFi 下的手机，在手机上测试游戏了。
def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # 尝试连一下 Google 的 DNS (8.8.8.8)，但这只是为了探测自己的 IP，不会真的发数据
        s.connect(('8.8.8.8', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1' # 如果没网，就用本机回环地址
    finally:
        s.close()
    return IP

# --- 打印启动信息 ---
print("-" * 50)
print(f"正在启动游戏服务器，端口: {PORT}...")
print("特殊文件支持 (WASM, JS) 已配置。")
print("多线程加速已开启。")
print("-" * 50)
print(f"👉 本机游玩地址:   http://localhost:{PORT}")
try:
    ip = get_ip()
    print(f"📱 手机/局域网地址: http://{ip}:{PORT}")
    print("   (注意：手机访问可能需要浏览器支持非HTTPS的摄像头权限)")
except:
    pass
print("-" * 50)

# 正式启动服务器，一直运行直到你按 Ctrl+C 停止
with ThreadingHTTPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止。")
