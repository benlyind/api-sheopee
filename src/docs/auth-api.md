# Dokumentasi API Autentikasi

API autentikasi ini menyediakan endpoint untuk registrasi, login, validasi token, dan refresh token. API ini menggunakan Supabase Auth untuk autentikasi dan JWT (JSON Web Token) untuk otorisasi.

## Endpoint

### 1. Register

Endpoint untuk mendaftarkan pengguna baru.

- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "fullName": "Nama Lengkap" // opsional
  }
  ```
- **Response Success** (201 Created):
  ```json
  {
    "token": "jwt_token_here",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "fullName": "Nama Lengkap"
    }
  }
  ```
- **Response Error** (400 Bad Request):
  ```json
  {
    "error": "Email dan password diperlukan"
  }
  ```
- **Response Error** (409 Conflict):
  ```json
  {
    "error": "Email sudah terdaftar"
  }
  ```

### 2. Login

Endpoint untuk login pengguna.

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response Success** (200 OK):
  ```json
  {
    "token": "jwt_token_here",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "fullName": "Nama Lengkap"
    }
  }
  ```
- **Response Error** (400 Bad Request):
  ```json
  {
    "error": "Email dan password diperlukan"
  }
  ```
- **Response Error** (401 Unauthorized):
  ```json
  {
    "error": "Email atau password salah"
  }
  ```

### 3. Me (Validasi Token)

Endpoint untuk mendapatkan informasi pengguna saat ini berdasarkan token.

- **URL**: `/api/auth/me`
- **Method**: `GET`
- **Headers**:
  ```
  Authorization: Bearer jwt_token_here
  ```
- **Response Success** (200 OK):
  ```json
  {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "fullName": "Nama Lengkap"
    }
  }
  ```
- **Response Error** (401 Unauthorized):
  ```json
  {
    "error": "Token tidak ditemukan"
  }
  ```
  atau
  ```json
  {
    "error": "Token tidak valid atau kadaluarsa"
  }
  ```

### 4. Refresh Token

Endpoint untuk memperbaharui token.

- **URL**: `/api/auth/refresh`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "token": "jwt_token_here"
  }
  ```
- **Response Success** (200 OK):
  ```json
  {
    "token": "new_jwt_token_here",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "fullName": "Nama Lengkap"
    }
  }
  ```
- **Response Error** (400 Bad Request):
  ```json
  {
    "error": "Token diperlukan"
  }
  ```
- **Response Error** (401 Unauthorized):
  ```json
  {
    "error": "Token tidak valid atau kadaluarsa"
  }
  ```

## Menggunakan Token untuk API Lainnya

Untuk mengakses API yang dilindungi dengan autentikasi, tambahkan header `Authorization` dengan nilai `Bearer jwt_token_here` pada setiap request.

Contoh:

```
GET /api/protected-example
Authorization: Bearer jwt_token_here
```

## Contoh Penggunaan dengan Fetch API

### Register

```javascript
const response = await fetch("/api/auth/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123",
    fullName: "Nama Lengkap",
  }),
});

const data = await response.json();
// Simpan token di localStorage atau state aplikasi
localStorage.setItem("token", data.token);
```

### Login

```javascript
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123",
  }),
});

const data = await response.json();
// Simpan token di localStorage atau state aplikasi
localStorage.setItem("token", data.token);
```

### Mengakses API yang Dilindungi

```javascript
const token = localStorage.getItem("token");

const response = await fetch("/api/protected-example", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const data = await response.json();
console.log(data);
```

### Refresh Token

```javascript
const token = localStorage.getItem("token");

const response = await fetch("/api/auth/refresh", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    token,
  }),
});

const data = await response.json();
// Update token di localStorage atau state aplikasi
localStorage.setItem("token", data.token);
```
