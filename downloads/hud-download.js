(() => {
  const button = document.getElementById('hudDownloadButton');
  const status = document.getElementById('hudDownloadStatus');
  const progress = document.getElementById('hudDownloadProgress');
  if (!button || !status || !progress) return;

  button.addEventListener('click', async () => {
    button.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    status.textContent = '正在準備下載…';
    try {
      const manifestResponse = await fetch('../downloads/aniimo-hud-v4-manifest.json');
      if (!manifestResponse.ok) throw new Error('找不到 HUD 下載資料');
      const manifest = await manifestResponse.json();
      const buffers = [];
      let received = 0;
      for (const [index, part] of manifest.parts.entries()) {
        const response = await fetch('../downloads/' + encodeURIComponent(part.file));
        if (!response.ok) throw new Error('第 ' + (index + 1) + ' 段下載失敗');
        let partBytes = 0;
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffers.push(value);
            received += value.byteLength;
            partBytes += value.byteLength;
            progress.value = Math.floor(received / manifest.size * 100);
            status.textContent = '正在下載 ' + progress.value + '% · 第 ' + (index + 1) + '/' + manifest.parts.length + ' 段';
          }
        } else {
          const value = await response.arrayBuffer();
          buffers.push(value);
          received += value.byteLength;
          partBytes += value.byteLength;
          progress.value = Math.floor(received / manifest.size * 100);
        }
        if (partBytes !== part.size) throw new Error('第 ' + (index + 1) + ' 段檔案大小不符');
      }
      if (received !== manifest.size) throw new Error('下載檔案大小不符');
      const url = URL.createObjectURL(new Blob(buffers, { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = manifest.filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 120000);
      status.textContent = '下載已開始。解壓整個資料夾後執行 EXE。';
      progress.value = 100;
    } catch (error) {
      status.textContent = '下載失敗：' + error.message + '。請稍後重試。';
      progress.hidden = true;
    } finally {
      button.disabled = false;
    }
  });
})();
