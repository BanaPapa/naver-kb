import { app, Tray, Menu, nativeImage, BrowserWindow, NativeImage } from 'electron';
import * as http from 'http';
import * as zlib from 'zlib';
import { createServer, AGENT_PORT } from './server';
import { hasCookies, clearAll } from './cookieStore';
import { openNaverLoginWindow } from './naverLoginWindow';

let tray: Tray | null = null;
let httpServer: http.Server | null = null;

// 16×16 단색 PNG를 런타임에 생성 (외부 아이콘 파일 불필요)
function makeSolidPng(size: number, r: number, g: number, b: number): NativeImage {
  const rowSize = 1 + size * 3; // filter byte + RGB×size
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    const base = y * rowSize;
    raw[base] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      raw[base + 1 + x * 3] = r;
      raw[base + 1 + x * 3 + 1] = g;
      raw[base + 1 + x * 3 + 2] = b;
    }
  }

  const deflated = zlib.deflateSync(raw);

  // CRC32 테이블
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tbl[i] = c;
  }
  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = tbl[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  const chunk = (type: string, data: Buffer): Buffer => {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.allocUnsafe(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.allocUnsafe(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // signature
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  return nativeImage.createFromBuffer(png);
}

function buildContextMenu(): Menu {
  const cookieOk = hasCookies();
  return Menu.buildFromTemplate([
    { label: 'Estate-OS Agent v1.0.0', enabled: false },
    { label: `포트: ${AGENT_PORT}`, enabled: false },
    {
      label: cookieOk ? '네이버: 로그인됨 ✓' : '네이버: 로그인 필요',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '네이버 로그인',
      click: () => {
        openNaverLoginWindow()
          .then(() => {
            tray?.setToolTip('Estate-OS Agent — 로그인됨');
            tray?.setContextMenu(buildContextMenu());
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Agent] 로그인 실패:', msg);
          });
      },
    },
    {
      label: '로그아웃 (쿠키 초기화)',
      click: () => {
        clearAll();
        tray?.setToolTip('Estate-OS Agent — 로그인 필요');
        tray?.setContextMenu(buildContextMenu());
      },
    },
    { type: 'separator' },
    {
      label: '웹앱 열기',
      click: () => {
        const win = new BrowserWindow({ width: 1280, height: 900 });
        win.loadURL('https://estate-os.vercel.app');
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => app.quit(),
    },
  ]);
}

function startHttpServer(): void {
  const expressApp = createServer();
  httpServer = expressApp.listen(AGENT_PORT, '127.0.0.1', () => {
    console.log(`[Estate-OS Agent] HTTP 서버 시작: http://127.0.0.1:${AGENT_PORT}`);
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Agent] 포트 ${AGENT_PORT} 이미 사용 중. 에이전트가 이미 실행 중입니다.`);
      app.quit();
    }
  });
}

function createTray(): void {
  // teal #00d4aa 아이콘
  const icon = makeSolidPng(16, 0, 212, 170);
  tray = new Tray(icon);
  tray.setToolTip('Estate-OS Agent — 로그인 필요');
  tray.setContextMenu(buildContextMenu());
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  startHttpServer();
  createTray();
});

app.on('window-all-closed', () => {
  // 트레이앱 유지 — 아무것도 하지 않음
});

app.on('before-quit', () => {
  httpServer?.close();
  tray?.destroy();
});
