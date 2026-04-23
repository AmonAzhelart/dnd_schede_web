/* eslint-disable @typescript-eslint/no-explicit-any */
// Google Drive + Picker integration via Google Identity Services.
// Uses script tags loaded in index.html (gsi/client + apis.google.com/js/api.js).

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

let accessToken: string | null = null;
let tokenExpiryMs = 0;
let tokenClient: any = null;
let pickerLoaded = false;

const tokenListeners = new Set<(t: string | null) => void>();
export const onTokenChange = (cb: (t: string | null) => void) => {
  tokenListeners.add(cb);
  return () => tokenListeners.delete(cb);
};
const emitToken = () => tokenListeners.forEach(cb => cb(accessToken));

export const getAccessToken = () => (accessToken && Date.now() < tokenExpiryMs ? accessToken : null);

export const isGoogleConfigured = () => !!GOOGLE_CLIENT_ID && !!GOOGLE_API_KEY;

const waitFor = (check: () => boolean, timeoutMs = 8000) =>
  new Promise<void>((resolve, reject) => {
    if (check()) return resolve();
    const start = Date.now();
    const id = setInterval(() => {
      if (check()) {
        clearInterval(id);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(id);
        reject(new Error('Timeout waiting for Google scripts'));
      }
    }, 100);
  });

const ensureTokenClient = async () => {
  if (tokenClient) return tokenClient;
  if (!GOOGLE_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID non configurato');
  await waitFor(() => !!window.google?.accounts?.oauth2);
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: () => { /* set per request */ },
  });
  return tokenClient;
};

export const requestDriveAccess = (): Promise<string> =>
  new Promise(async (resolve, reject) => {
    try {
      const client = await ensureTokenClient();
      client.callback = (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        accessToken = resp.access_token;
        tokenExpiryMs = Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60_000;
        emitToken();
        resolve(accessToken!);
      };
      client.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
    } catch (e) {
      reject(e);
    }
  });

export const revokeDriveAccess = async () => {
  if (!accessToken) return;
  try {
    await new Promise<void>(res =>
      window.google?.accounts?.oauth2?.revoke(accessToken, () => res())
    );
  } catch { /* ignore */ }
  accessToken = null;
  tokenExpiryMs = 0;
  emitToken();
};

const driveFetch = async (path: string, init?: RequestInit) => {
  const token = getAccessToken();
  if (!token) throw new Error('Non autorizzato a Drive');
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  return res;
};

export const listFolder = async (folderId: string): Promise<DriveFile[]> => {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent(
    'files(id,name,mimeType,iconLink,thumbnailLink,webViewLink,modifiedTime,size)'
  );
  const res = await driveFetch(
    `/files?q=${q}&fields=${fields}&orderBy=folder,name&pageSize=200`
  );
  const json = await res.json();
  return json.files || [];
};

export const getFile = async (fileId: string): Promise<DriveFile> => {
  const fields = encodeURIComponent(
    'id,name,mimeType,iconLink,thumbnailLink,webViewLink,modifiedTime,size,parents'
  );
  const res = await driveFetch(`/files/${fileId}?fields=${fields}`);
  return res.json();
};

/** Returns plain-text content of a Drive file when possible. */
export const getFileText = async (file: DriveFile): Promise<string> => {
  const mt = file.mimeType;
  if (mt === 'application/vnd.google-apps.document') {
    const r = await driveFetch(`/files/${file.id}/export?mimeType=text/plain`);
    return r.text();
  }
  if (mt === 'application/vnd.google-apps.spreadsheet') {
    const r = await driveFetch(`/files/${file.id}/export?mimeType=text/csv`);
    return r.text();
  }
  if (mt === 'application/vnd.google-apps.presentation') {
    const r = await driveFetch(`/files/${file.id}/export?mimeType=text/plain`);
    return r.text();
  }
  if (mt.startsWith('text/') || mt === 'application/json') {
    const r = await driveFetch(`/files/${file.id}?alt=media`);
    return r.text();
  }
  throw new Error(`Tipo file non supportato per estrazione testo: ${mt}`);
};

export const isTextExtractable = (mimeType: string) =>
  mimeType.startsWith('text/') ||
  mimeType === 'application/json' ||
  mimeType === 'application/vnd.google-apps.document' ||
  mimeType === 'application/vnd.google-apps.spreadsheet' ||
  mimeType === 'application/vnd.google-apps.presentation';

// === Picker ===
const loadPicker = async () => {
  if (pickerLoaded) return;
  await waitFor(() => !!window.gapi);
  await new Promise<void>(res => window.gapi.load('picker', { callback: () => res() }));
  pickerLoaded = true;
};

export const pickFolder = async (): Promise<{ id: string; name: string } | null> => {
  if (!GOOGLE_API_KEY) throw new Error('VITE_GOOGLE_API_KEY non configurato');
  const token = getAccessToken() || (await requestDriveAccess());
  await loadPicker();

  return new Promise(resolve => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setMimeTypes('application/vnd.google-apps.folder')
      .setIncludeFolders(true);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY!)
      .setTitle('Scegli la cartella della tua campagna')
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs?.[0];
          if (doc) resolve({ id: doc.id, name: doc.name });
          else resolve(null);
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
};
