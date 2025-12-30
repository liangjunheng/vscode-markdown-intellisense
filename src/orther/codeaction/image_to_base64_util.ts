import * as vscode from 'vscode';
import * as path from 'path-browserify';

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

const IMAGE_EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

function getImageMimeFromUrl(url: string): string | undefined {
  // 1. 去掉 query 和 hash
  const clean = url.split('#')[0].split('?')[0];

  // 2. 取路径最后一段
  const last = clean.split('/').pop() || '';
  const dotIndex = last.lastIndexOf('.');
  if (dotIndex === -1) {
    // 没有后缀，返回 undefined 表示不是“可识别的图片”
    return undefined;
  }

  const ext = last.substring(dotIndex + 1).toLowerCase();

  // 3. 查图片表
  return IMAGE_EXT_TO_MIME[ext];
}

export async function imageToBase64(urlPath: string | undefined, targetWidth: number): Promise<string | undefined> {
  if (urlPath === undefined || urlPath === '') {
    return undefined
  }

  // 1. 检查是不是图片类型
  const mime = getImageMimeFromUrl(urlPath);
  if (mime === undefined) {
    return undefined
  }

  // 3. 用 VS Code API 读取图片为 Uint8Array
  var base64 = ""
  try {
    var absPath: vscode.Uri = vscode.Uri.file(urlPath);
    try {
      await vscode.workspace.fs.stat(absPath)
    } catch (error) {
      console.error(`imageToBase64, path: ${absPath}, error: ${error}`)

      const curDocUri = vscode.window.activeTextEditor?.document.uri
      if (curDocUri) {
        const baseDir = path.dirname(curDocUri.toString(true) ?? "");
        absPath = vscode.Uri.joinPath(vscode.Uri.parse(baseDir), urlPath)
      }
    }

    console.log(`imageToBase64, absPath: ${absPath}`)
    const bytes = await vscode.workspace.fs.readFile(absPath);
    const buffer = Buffer.from(bytes);
    base64 = buffer.toString('base64');
  } catch (error) {
    console.error(`imageToBase64, readFile: ${error}`)
    return undefined
  }

  // 4. 转成 base64 dataURL（这里简单假设是 png，需要可根据扩展名判断 mime）
  const dataUrl = `data:${mime};base64,${base64}`;

  // 5. 创建一个“临时” Webview，用来在前端做 canvas 缩放
  const panel = vscode.window.createWebviewPanel(
    'resizeImageHidden',
    'Resize Image',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true }
  );

  // 注入 HTML + 脚本（下面给出 getWebviewHtml）
  panel.webview.html = getWebviewHtml(dataUrl, targetWidth, mime);

  // 6. 接收 Webview 回传的 base64 结果
  return await new Promise<string | undefined>((resolve) => {
    panel.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'ok') {
        const resizedDataUrl: string = msg.dataUrl; // data:image/...;base64,xxxx
        console.log('imageToBase64, RESIZED_BASE64:', resizedDataUrl);
        panel.dispose();
        resolve(msg.dataUrl);
      } else if (msg.type === 'error') {
        console.log('imageToBase64, error: ' + msg.error);
        panel.dispose();
        resolve(undefined);
      }
    });
  });
}

function getWebviewHtml(dataUrl: string, targetWidth: number, mime: string): string {
  // 纯前端实现：用 canvas 等比缩放并输出 base64
  return `
<!DOCTYPE html>
<html>
  <body>
    <script>
      const vscode = acquireVsCodeApi();

      async function resizeByWidthToBase64(dataUrl, targetWidth, mime) {
        const img = new Image();
        img.src = dataUrl;
        await img.decode(); // 确保图片加载完成

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        if(targetWidth > 0 && img.width > targetWidth) {
          const scale = targetWidth / img.width;
          const newHeight = img.height * scale;
          
          canvas.width = targetWidth;
          canvas.height = newHeight;
        }

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 这里直接返回 dataURL，即 base64 字符串[[12](https://blog.csdn.net/cczhumin/article/details/50990329)][[14](https://www.jb51.net/javascript/3023762jc.htm)]
        return canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.8 : undefined);
      }

      (async () => {
        try {
          const result = await resizeByWidthToBase64(
            ${JSON.stringify(dataUrl)},
            ${targetWidth},
            ${JSON.stringify(mime)}
          );
          vscode.postMessage({ type: 'ok', dataUrl: result });
        } catch (e) {
          vscode.postMessage({ type: 'error', error: String(e) });
        }
      })();
    </script>
  </body>
</html>`;
}



////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

const imageRegex = /^!\[(.*?)\]\((.+)\)$/;
export function getMarkdownImageFromLine(lineText: string): { alt: string; url: string; } | undefined {
  const match = lineText.match(imageRegex);
  console.log(`getMarkdownImageFromLine, ${match}`)
  if (!match) return undefined;

  const [, alt, url] = match;
  return { alt, url };
}