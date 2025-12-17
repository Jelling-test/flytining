# 🗺️ KORT OG EL-INFRASTRUKTUR

**Opdateret:** 16. december 2025

---

## 📊 OVERSIGT

Interaktivt kort over campingpladsen med drag-and-drop placering af alle elementer samt komplet el-infrastruktur mapping.

**Teknologi:** React Konva (canvas-baseret)

---

## 🗺️ KORT FUNKTIONER (`/admin/kort`)

### Elementer på kortet

| Element | Form | Farve | Beskrivelse |
|---------|------|-------|-------------|
| **Hovedtavle** | Firkant stor | Rød | Hovedstrømforsyning |
| **Fordelingstavle** | Firkant medium | Grøn | Fordelingspunkt |
| **Stander** | Trekant | Blå | El-stander med målere |
| **Måler** | Cirkel lille | Grøn/Rød | Grøn=online, Rød=offline |
| **Plads** | Cirkel | Grå | Campingplads |
| **Hytte** | Firkant | Brun | Hytte |
| **Forbindelse** | Linje | Sort | Kabel mellem tavler |

### Funktioner

**Visning:**
- Zoom ind/ud (scroll eller knapper)
- Pan (træk med mus)
- Filtrér element typer (vis/skjul)
- Vælg dato for historisk visning

**Redigering:**
- Drag-and-drop placering
- Klik for at åbne detaljer
- Lås/lås op elementer (forhindrer flytning)
- Dobbelt-klik for hurtig redigering

**Print:**
- Print kortudsnit
- PDF eksport

### Dato-visning
Vælg en dato for at se:
- Hvilke pladser var optaget
- Hvem var på hvilken plads
- Historisk belægning

---

## ⚡ EL-INFRASTRUKTUR (`/admin/el-infrastruktur`)

### Hierarki

```
Hovedtavle (Main Board)
  └── Fordelingstavle (Distribution Board)
        └── Sikringsgruppe (Fuse Group)
              └── Stander (Power Stand)
                    └── Måler (Meter)
```

### Hovedtavler (Main Boards)

Campingpladsens primære strømforsyningspunkter.

**Felter:**
- Navn (f.eks. "Hovedtavle Nord")
- Beskrivelse
- Lokation
- Kort position (x, y)
- Farve (til kort visning)

**Eksempel:**
| Navn | Lokation | Farve |
|------|----------|-------|
| Hovedtavle Nord | Ved reception | Rød |
| Hovedtavle Syd | Ved servicebygning | Orange |

### Fordelingstavler (Distribution Boards)

Sekundære tavler der fordeler strøm fra hovedtavle.

**Felter:**
- Navn
- Tavlenummer
- Tilknyttet hovedtavle
- Lokation
- Kort position
- Farve

**Eksempel:**
| Navn | Nr. | Hovedtavle | Sikringsgrupper |
|------|-----|------------|-----------------|
| Fordeling A | 1 | Hovedtavle Nord | 4 |
| Fordeling B | 2 | Hovedtavle Nord | 6 |

### Sikringsgrupper (Fuse Groups)

Individuelle sikringer på fordelingstavle.

**Felter:**
- Gruppenummer
- Navn
- Sikringsstørrelse (f.eks. "16A", "25A")
- Beskrivelse
- Tilknyttet fordelingstavle

**Eksempel:**
| Gruppe | Navn | Sikring | Standere |
|--------|------|---------|----------|
| 1 | Område 100-110 | 25A | 3 |
| 2 | Område 111-120 | 25A | 3 |

### Standere (Power Stands)

Fysiske el-standere med stikkontakter.

**Felter:**
- Navn/nummer
- Kort position
- Tilknyttet sikringsgruppe
- Tilknyttede målere

**Eksempel:**
| Stander | Sikringsgruppe | Målere |
|---------|----------------|--------|
| S-101 | Gruppe 1 | F44, F45 |
| S-102 | Gruppe 1 | F46, F47 |

### Forbindelser (Board Connections)

Kabler mellem tavler (vises som linjer på kort).

**Felter:**
- Fra tavle
- Til tavle
- Kabeltype

---

## 📋 DATABASE SCHEMA

### main_boards
```sql
CREATE TABLE main_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  map_x DOUBLE PRECISION,
  map_y DOUBLE PRECISION,
  map_locked BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#DC2626',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### distribution_boards
```sql
CREATE TABLE distribution_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_board_id UUID REFERENCES main_boards(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  board_number INTEGER,
  location TEXT,
  map_x DOUBLE PRECISION,
  map_y DOUBLE PRECISION,
  map_locked BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#16A34A',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### fuse_groups
```sql
CREATE TABLE fuse_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES distribution_boards(id) ON DELETE CASCADE,
  group_number INTEGER NOT NULL,
  name TEXT,
  fuse_rating TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### power_stands
```sql
CREATE TABLE power_stands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  map_x DOUBLE PRECISION,
  map_y DOUBLE PRECISION,
  map_locked BOOLEAN DEFAULT false,
  fuse_group_id UUID REFERENCES fuse_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tilføj til power_meters
ALTER TABLE power_meters ADD COLUMN stand_id UUID REFERENCES power_stands(id);
ALTER TABLE power_meters ADD COLUMN map_x DOUBLE PRECISION;
ALTER TABLE power_meters ADD COLUMN map_y DOUBLE PRECISION;
```

### board_connections
```sql
CREATE TABLE board_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_board_id UUID NOT NULL,
  to_board_id UUID NOT NULL,
  from_board_type TEXT NOT NULL, -- 'main' eller 'distribution'
  to_board_type TEXT NOT NULL,
  cable_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### map_spots
```sql
CREATE TABLE map_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_number TEXT NOT NULL,
  spot_type TEXT DEFAULT 'standard' CHECK (spot_type IN ('standard', 'comfort', 'premium', 'seasonal')),
  customer_type TEXT DEFAULT 'camping' CHECK (customer_type IN ('camping', 'seasonal', 'cabin')),
  map_x DOUBLE PRECISION,
  map_y DOUBLE PRECISION,
  map_locked BOOLEAN DEFAULT false,
  meter_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### map_cabins
```sql
CREATE TABLE map_cabins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabin_number TEXT NOT NULL,
  cabin_type TEXT,
  map_x DOUBLE PRECISION,
  map_y DOUBLE PRECISION,
  color TEXT DEFAULT '#8B4513',
  rotation DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🎨 REACT KONVA IMPLEMENTATION

### Basis struktur
```tsx
import { Stage, Layer, Circle, Rect, Text, Line, RegularPolygon } from "react-konva";

function CampingMap() {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  return (
    <Stage
      width={window.innerWidth}
      height={window.innerHeight}
      scaleX={scale}
      scaleY={scale}
      x={position.x}
      y={position.y}
      draggable
      onWheel={handleZoom}
    >
      <Layer>
        {/* Forbindelser (baggrund) */}
        {connections.map(conn => (
          <Line
            key={conn.id}
            points={[conn.x1, conn.y1, conn.x2, conn.y2]}
            stroke="#333"
            strokeWidth={2}
          />
        ))}
        
        {/* Hovedtavler */}
        {mainBoards.map(board => (
          <Rect
            key={board.id}
            x={board.map_x}
            y={board.map_y}
            width={60}
            height={40}
            fill={board.color}
            draggable={!board.map_locked}
            onClick={() => selectBoard(board)}
            onDragEnd={(e) => updatePosition(board.id, e)}
          />
        ))}
        
        {/* Fordelingstavler */}
        {distBoards.map(board => (
          <Rect
            key={board.id}
            x={board.map_x}
            y={board.map_y}
            width={40}
            height={30}
            fill={board.color}
            draggable={!board.map_locked}
          />
        ))}
        
        {/* Standere (trekant) */}
        {stands.map(stand => (
          <RegularPolygon
            key={stand.id}
            x={stand.map_x}
            y={stand.map_y}
            sides={3}
            radius={20}
            fill="#2563eb"
            draggable={!stand.map_locked}
          />
        ))}
        
        {/* Målere (cirkel) */}
        {meters.map(meter => (
          <Circle
            key={meter.id}
            x={meter.map_x}
            y={meter.map_y}
            radius={8}
            fill={meter.is_online ? '#16a34a' : '#dc2626'}
          />
        ))}
        
        {/* Labels */}
        {meters.map(meter => (
          <Text
            key={`label-${meter.id}`}
            x={meter.map_x - 15}
            y={meter.map_y + 12}
            text={meter.meter_number}
            fontSize={10}
          />
        ))}
      </Layer>
    </Stage>
  );
}
```

### Zoom funktion
```tsx
const handleZoom = (e: KonvaEventObject<WheelEvent>) => {
  e.evt.preventDefault();
  
  const scaleBy = 1.1;
  const stage = e.target.getStage();
  const oldScale = stage.scaleX();
  
  const pointer = stage.getPointerPosition();
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };
  
  const newScale = e.evt.deltaY > 0 
    ? oldScale / scaleBy 
    : oldScale * scaleBy;
  
  setScale(newScale);
  setPosition({
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  });
};
```

---

## 🔧 BRUG AF KORT

### Opret ny el-infrastruktur

1. **Opret hovedtavle:**
   - Gå til El-Infrastruktur → Hovedtavler → Tilføj
   - Indtast navn og lokation
   - Gem

2. **Opret fordelingstavle:**
   - Gå til Fordelingstavler → Tilføj
   - Vælg hovedtavle
   - Indtast navn og nummer
   - Gem

3. **Opret sikringsgrupper:**
   - Gå til Sikringsgrupper → Tilføj
   - Vælg fordelingstavle
   - Indtast gruppenummer og sikringsstørrelse
   - Gem

4. **Opret stander:**
   - Gå til Standere → Tilføj
   - Indtast navn
   - Vælg sikringsgruppe
   - Gem

5. **Tildel målere:**
   - Gå til Standere → Vælg stander → Tildel målere
   - Vælg målere fra listen
   - Gem

6. **Placér på kort:**
   - Gå til Kort
   - Træk elementer til korrekt position
   - Klik "Lås" for at forhindre flytning

---

## 🔍 FEJLSØGNING MED KORT

### Find problem-områder

1. Åbn Kort
2. Se efter røde cirkler (offline målere)
3. Klik på måler for detaljer
4. Tjek om hele stander/sikringsgruppe er offline

### Identificer overbelastning

1. Gå til El-Infrastruktur
2. Se "Belastning" kolonne for hver sikringsgruppe
3. Høj belastning = potentielt problem
