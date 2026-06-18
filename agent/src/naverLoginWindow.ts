import { BrowserWindow, session } from 'electron';
import { setCookie, setBearer } from './cookieStore';

const PARTITION = 'persist:naver';
const LOGIN_URL =
  'https://nid.naver.com/nidlogin.login?mode=form&url=https%3A%2F%2Fland.naver.com%2F';

// 로그인 후 새땅(new.land)에서 Bearer를 캡처할 때까지 대기하는 시간(ms)
const BEARER_WAIT_MS = 6000;

export async function openNaverLoginWindow(): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 480,
      height: 750,
      title: 'Estate-OS — 네이버 로그인',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: PARTITION,
      },
      autoHideMenuBar: true,
      resizable: false,
    });

    const ses = session.fromPartition(PARTITION);
    let loginDetected = false;

    // new.land API 요청에서 Authorization 헤더 인터셉트 → Bearer 캡처
    ses.webRequest.onBeforeSendHeaders(
      { urls: ['https://new.land.naver.com/*'] },
      (details, callback) => {
        const auth =
          (details.requestHeaders['Authorization'] as string | undefined) ??
          (details.requestHeaders['authorization'] as string | undefined);
        if (auth?.startsWith('Bearer ')) {
          setBearer(auth.slice(7));
        }
        callback({ requestHeaders: details.requestHeaders });
      },
    );

    const finishLogin = async (): Promise<void> => {
      if (loginDetected) return;
      loginDetected = true;

      // 쿠키 캡처
      const cookies = await ses.cookies.get({ domain: '.naver.com' });
      const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      setCookie(cookieStr);

      // new.land로 이동해 Bearer 토큰 유발
      if (!win.isDestroyed()) {
        win.loadURL('https://new.land.naver.com/houses');
      }

      // Bearer 캡처를 위해 잠시 대기 후 창 닫기
      setTimeout(() => {
        if (!win.isDestroyed()) win.close();
        resolve();
      }, BEARER_WAIT_MS);
    };

    // 네이버 로그인 성공 = land.naver.com으로 리디렉션
    win.webContents.on('did-navigate', (_event, url) => {
      if (
        (url.startsWith('https://land.naver.com') ||
          url.startsWith('https://m.land.naver.com')) &&
        !loginDetected
      ) {
        finishLogin();
      }
    });

    win.on('closed', () => {
      if (!loginDetected) {
        reject(new Error('로그인 창이 닫혔습니다. 로그인을 완료한 뒤 다시 시도해 주세요.'));
      }
    });

    win.loadURL(LOGIN_URL);
  });
}
