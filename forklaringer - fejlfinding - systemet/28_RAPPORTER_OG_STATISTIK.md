# 📊 RAPPORTER OG STATISTIK

**Opdateret:** 16. december 2025

---

## 📋 OVERSIGT

Rapportsystem til overblik over forbrug, salg, kunder og målere.

**Side:** `/admin/rapporter`

---

## 📈 RAPPORTTYPER

### 1. Daglig Rapport

**Formål:** Dagligt overblik for en specifik dato.

**Indhold:**
- Antal aktive kunder
- Antal nye kunder (ankommet i dag)
- Antal afrejste kunder
- Total strømforbrug (kWh)
- Antal solgte pakker
- Total omsætning
- Antal online/offline målere

**Brug:**
1. Vælg dato
2. Klik "Hent rapport"
3. Se data eller download

### 2. Salgsrapport

**Formål:** Omsætning over periode.

**Indhold:**
- Antal solgte pakker per dag
- Omsætning per dag
- Gennemsnitlig pakkestørrelse
- Graf over salgsudvikling

**Brug:**
1. Vælg start- og slutdato
2. Klik "Hent rapport"
3. Se graf og tabel
4. Download CSV

### 3. Forbrugsrapport

**Formål:** Strømforbrug over periode.

**Indhold:**
- Total forbrug (kWh)
- Gennemsnitligt dagligt forbrug
- Top 10 forbrugere
- Graf over forbrugsudvikling

**Brug:**
1. Vælg start- og slutdato
2. Klik "Hent rapport"
3. Se graf og liste

### 4. Pakkehistorik

**Formål:** Historik over alle solgte pakker.

**Indhold:**
- Liste over alle pakker i periode
- Booking nummer
- Pakkestørrelse
- Pris
- Status (aktiv/opbrugt)
- Resterende enheder

**Brug:**
1. Vælg periode
2. Se tabel
3. Søg på booking
4. Download CSV

### 5. Målerhistorik

**Formål:** Detaljeret historik for specifik måler.

**Indhold:**
- Forbrugsdata over tid
- Graf med energy/power
- Statusændringer
- Tilknyttede kunder

**Brug:**
1. Søg på målernummer
2. Vælg periode
3. Se graf og data

### 6. Kundestatistik

**Formål:** Overblik over kundebase.

**Indhold:**
- Antal regular vs seasonal kunder
- Fordeling på sprog
- Gennemsnitligt ophold
- Returkunder

---

## 📧 AUTOMATISKE RAPPORTER

### Daglig Regnskabsrapport
**Cron:** `daily-accounting-report` (23:59 UTC)

**Modtager:** accounting_email fra settings

**Indhold:**
- Dagens salg
- Antal transaktioner
- Breakdown per betalingstype
- Sammenligning med samme dag sidste uge

### Dagligt Pakke Snapshot
**Cron:** `daily-package-snapshot` (23:59 UTC)

**Gemmes i:** `daily_package_stats`

**Data:**
```sql
{
  date: '2025-12-16',
  total_packages: 45,
  active_packages: 32,
  total_units_sold: 2500,
  total_revenue: 7500
}
```

---

## 📊 GRAFER (Chart.js)

### Forbrugsgraf
```tsx
<Line
  data={{
    labels: dates,
    datasets: [{
      label: 'Forbrug (kWh)',
      data: consumptionData,
      borderColor: '#2563eb',
      fill: false
    }]
  }}
  options={{
    responsive: true,
    scales: {
      y: { beginAtZero: true }
    }
  }}
/>
```

### Salgsgraf
```tsx
<Bar
  data={{
    labels: dates,
    datasets: [{
      label: 'Omsætning (DKK)',
      data: salesData,
      backgroundColor: '#16a34a'
    }]
  }}
/>
```

### Kundefordeling
```tsx
<Pie
  data={{
    labels: ['Regular', 'Seasonal', 'Cabin'],
    datasets: [{
      data: [120, 45, 28],
      backgroundColor: ['#2563eb', '#16a34a', '#ca8a04']
    }]
  }}
/>
```

---

## 📥 EKSPORT

### CSV Eksport
```tsx
const downloadCSV = (data: any[], filename: string) => {
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).join(','));
  const csv = [headers, ...rows].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
};
```

### PDF Eksport
Brug browser print eller html2pdf library.

---

## 🔍 SQL QUERIES FOR RAPPORTER

### Dagligt forbrug per måler
```sql
SELECT 
  meter_id,
  DATE(time) as dato,
  MAX(energy) - MIN(energy) as forbrug_kwh
FROM meter_readings
WHERE time >= '2025-12-01' AND time < '2025-12-17'
GROUP BY meter_id, DATE(time)
ORDER BY dato, meter_id;
```

### Salg per dag
```sql
SELECT 
  DATE(created_at) as dato,
  COUNT(*) as antal_pakker,
  SUM((data->>'pris')::numeric) as omsaetning
FROM plugin_data
WHERE module = 'pakker'
  AND created_at >= '2025-12-01'
GROUP BY DATE(created_at)
ORDER BY dato;
```

### Top 10 forbrugere
```sql
SELECT 
  mr.meter_id,
  rc.customer_name,
  rc.booking_id,
  MAX(mr.energy) - MIN(mr.energy) as forbrug_kwh
FROM meter_readings mr
JOIN power_meters pm ON mr.meter_id = pm.meter_number
JOIN regular_customers rc ON rc.meter_id = pm.meter_number
WHERE mr.time >= NOW() - INTERVAL '30 days'
GROUP BY mr.meter_id, rc.customer_name, rc.booking_id
ORDER BY forbrug_kwh DESC
LIMIT 10;
```

### Kundestatistik
```sql
SELECT 
  language,
  COUNT(*) as antal
FROM regular_customers
WHERE arrival_date >= '2025-01-01'
GROUP BY language;
```
