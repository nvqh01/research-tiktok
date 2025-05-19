# tiktok-web-reverse-engineering
Tiktok Web Reverse Engineering X-Bogus &amp; X-Gnarly implementation
# TikTok Signature Utility

A lightweight utility to generate signed TikTok API request URLs using a headless navigator. Designed for environments requiring dynamic request signing with proper user-agent emulation.

## ✨ Features

- Async URL signing for TikTok API requests  
- Supports both GET and POST formats  
- Extracts valid `User-Agent` headers  
- Ideal for proxies, automation, and scraping tasks

## 🛠 Usage

```ts
import { signParams } from 'tiktok-signature-utils';

const { signature, userAgent } = await signParams({
  params,
  url: 'https://www.tiktok.com/api/commit/item/digg',
  body: {
    action: 1
  }
});

await fetch(signature.signedUrl, {
  method: 'POST',
  headers: {
    'User-Agent': userAgent,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ action: 1 })
});
```

## 📘 API

### `signParams({ params, url, body })`

#### Parameters:
- `params`: Object of query string parameters
- `url`: Base TikTok API endpoint
- `body`: Optional object for request body

#### Returns:
- `signature.signedUrl`: Fully signed URL
- `userAgent`: Emulated User-Agent header

## 🧪 Implementation Example

```ts
export async function signParams(data) {
  const navigator = await signer.navigator();
  const { userAgent } = navigator;

  const queryString = new URLSearchParams({
    ...data.params
  }).toString();

  const unsignedUrl = `${data.url}/?${queryString}`;

  let body = '';
  if (data.body) {
    body = JSON.stringify(data.body);
  }

  const signedUrl = await signer.Sign(unsignedUrl, body);

  return { signature: { signedUrl }, userAgent };
}
```

## 📄 License

MIT © 2025
