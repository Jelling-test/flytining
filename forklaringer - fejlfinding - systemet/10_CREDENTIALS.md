# 🔐 CREDENTIALS OG ADGANGSKODER

**Opdateret:** 16. december 2025

---

## ⚠️ FORTROLIGT DOKUMENT

Denne fil indeholder adgangskoder og API nøgler.
**Del IKKE denne fil offentligt!**

---

## 🗄️ SUPABASE

| Parameter | Værdi |
|-----------|-------|
| **Projekt ID** | `jkmqliztlhmfyejhmuil` |
| **URL** | https://jkmqliztlhmfyejhmuil.supabase.co |
| **Dashboard** | https://supabase.com/dashboard/project/jkmqliztlhmfyejhmuil |

### API Keys
| Key | Brug |
|-----|------|
| **anon key** | Frontend (public) |
| **service_role key** | Backend (secret) |

*Hent fra: Project Settings → API*

---

## 📡 MQTT BROKER

| Parameter | Værdi |
|-----------|-------|
| **Host** | 192.168.9.61 |
| **Port (ekstern)** | 1890 |
| **Port (intern)** | 1883 |
| **Username** | homeassistant |
| **Password** | 7200Grindsted! |

---

## 🖥️ NAS SERVER

| Parameter | Værdi |
|-----------|-------|
| **IP** | 192.168.9.61 |
| **SSH User** | jc |
| **DSM URL** | http://192.168.9.61:5000 |

### SSH Adgang
```bash
ssh jc@192.168.9.61
```

---

## 📧 BREVO (Email)

| Parameter | Værdi |
|-----------|-------|
| **Dashboard** | https://app.brevo.com |
| **API Key** | *Hent fra Supabase Secrets* |

---

## 💳 STRIPE

| Parameter | Værdi |
|-----------|-------|
| **Dashboard** | https://dashboard.stripe.com |
| **Mode** | Live |

### Secrets (i Supabase)
- `STRIPE_SECRET_KEY` - API nøgle
- `STRIPE_WEBHOOK_SECRET` - Webhook signering

---

## 🔌 ZIGBEE COORDINATORS

| Område | IP | Web UI |
|--------|----|--------|
| 1 | 192.168.0.254 | http://192.168.0.254 |
| 2 | 192.168.1.35 | http://192.168.1.35 |
| 3 | 192.168.1.36 | http://192.168.1.36 |
| 4 | 192.168.1.37 | http://192.168.1.37 |
| 5 | 192.168.1.38 | http://192.168.1.38 |
| 3-fase | 192.168.1.39 | http://192.168.1.39 |

---

## 📹 AXIS KAMERA (ANPR)

| Parameter | Værdi |
|-----------|-------|
| **IP** | 152.115.191.134:65471 |
| **Formål** | Nummerplade scanning |

---

## 🌐 VERCEL (Hosting)

| App | URL |
|-----|-----|
| **Admin/Staff** | https://test-af-system.vercel.app |
| **Gæsteportal** | https://jelling.vercel.app |

### GitHub Repos
- Admin: https://github.com/Jelling-test/test.af.system
- Portal: https://github.com/Jelling-test/implentering-af-personligside-

---

## 🔄 ENVIRONMENT VARIABLES

### Frontend (.env.local)
```env
VITE_SUPABASE_URL=https://jkmqliztlhmfyejhmuil.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Supabase Secrets
```
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
BREVO_API_KEY
```

### Docker (.env)
```env
MQTT_HOST=mosquitto
MQTT_PORT=1883
MQTT_USER=homeassistant
MQTT_PASS=7200Grindsted!
SUPABASE_URL=https://jkmqliztlhmfyejhmuil.supabase.co
SUPABASE_KEY=eyJ...
```

---

## 📋 TJEKLISTE VED NY INSTALLATION

- [ ] Supabase projekt oprettet
- [ ] API keys kopieret til frontend .env
- [ ] Secrets tilføjet til Supabase
- [ ] MQTT credentials sat i Docker .env
- [ ] Coordinator IP'er konfigureret
- [ ] Zigbee2MQTT config sat med korrekte passwords
- [ ] Vercel environment variables sat
