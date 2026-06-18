interface Store {
  cookie: string;
  bearer: string;
  loginDate: string | null;
}

let store: Store = { cookie: '', bearer: '', loginDate: null };

export function setCookie(cookie: string): void {
  store = { ...store, cookie, loginDate: new Date().toISOString() };
}

export function setBearer(bearer: string): void {
  store = { ...store, bearer };
}

export function getCookie(): string {
  return store.cookie;
}

export function getBearer(): string {
  return store.bearer;
}

export function hasCookies(): boolean {
  return store.cookie !== '';
}

export function getLoginDate(): string | null {
  return store.loginDate;
}

export function clearAll(): void {
  store = { cookie: '', bearer: '', loginDate: null };
}
