# Plan Integracji Frontend - System Przełączania Ograniczeń IP

## 📋 Przegląd Funkcjonalności

System pozwala na dynamiczne włączanie/wyłączanie ograniczeń IP przez interfejs administratora z pełną kontrolą nad trybami działania.

## 🔗 API Endpoints

### 1. **Pobierz Ustawienia**
```http
GET /api/ip-restrictions/settings
```

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Ustawienia ograniczeń IP pobrane pomyślnie",
  "data": {
    "_id": "...",
    "isEnabled": true,
    "mode": "development",
    "allowLocalhostInProduction": false,
    "enableDetailedLogging": true,
    "maxUnauthorizedAttemptsPerHour": 100,
    "lastChangeDescription": "Automatyczne utworzenie domyślnych ustawień",
    "lastModifiedBy": {
      "_id": "...",
      "name": {
        "first": "Admin",
        "last": "User"
      },
      "email": "admin@example.com"
    },
    "createdAt": "2025-01-25T10:00:00.000Z",
    "updatedAt": "2025-01-25T10:00:00.000Z"
  }
}
```

### 2. **Aktualizuj Ustawienia**
```http
PUT /api/ip-restrictions/settings
```

**Body:**
```json
{
  "isEnabled": true,
  "mode": "strict",
  "allowLocalhostInProduction": false,
  "enableDetailedLogging": true,
  "maxUnauthorizedAttemptsPerHour": 50,
  "lastChangeDescription": "Przełączenie na tryb produkcyjny"
}
```

### 3. **Szybkie Przełączenie (Toggle)**
```http
POST /api/ip-restrictions/settings/toggle
```

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Ograniczenia IP zostały włączone",
  "data": {
    "isEnabled": true,
    "previousState": false,
    "changedBy": {
      "_id": "...",
      "name": { "first": "Admin", "last": "User" },
      "email": "admin@example.com"
    },
    "changedAt": "2025-01-25T10:30:00.000Z"
  }
}
```

## 🎨 Komponenty Frontend

### 1. **Główny Panel Ograniczeń IP**

```tsx
// IpRestrictionsPanel.tsx
import React, { useState, useEffect } from 'react';
import { Switch, Card, Button, Alert, Spin } from 'antd';
import { SecurityScanOutlined, WarningOutlined } from '@ant-design/icons';

interface IpRestrictionSettings {
  _id: string;
  isEnabled: boolean;
  mode: 'strict' | 'development' | 'disabled';
  allowLocalhostInProduction: boolean;
  enableDetailedLogging: boolean;
  maxUnauthorizedAttemptsPerHour: number;
  lastChangeDescription: string;
  lastModifiedBy: {
    name: { first: string; last: string };
    email: string;
  };
  updatedAt: string;
}

const IpRestrictionsPanel: React.FC = () => {
  const [settings, setSettings] = useState<IpRestrictionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Pobierz ustawienia
  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/ip-restrictions/settings', {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Błąd pobierania ustawień:', error);
    } finally {
      setLoading(false);
    }
  };

  // Szybkie przełączenie
  const handleToggle = async () => {
    setToggling(true);
    try {
      const response = await fetch('/api/ip-restrictions/settings/toggle', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        // Odśwież ustawienia
        await fetchSettings();
        
        // Pokaż powiadomienie
        notification.success({
          message: 'Sukces',
          description: data.message,
          duration: 3
        });
      }
    } catch (error) {
      notification.error({
        message: 'Błąd',
        description: 'Nie udało się przełączyć ograniczeń IP'
      });
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading) return <Spin size="large" />;

  return (
    <Card 
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SecurityScanOutlined />
          Ograniczenia IP
        </div>
      }
      extra={
        <Switch
          checked={settings?.isEnabled}
          loading={toggling}
          onChange={handleToggle}
          checkedChildren="Włączone"
          unCheckedChildren="Wyłączone"
        />
      }
    >
      {settings?.isEnabled === false && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="Ograniczenia IP są wyłączone"
          description="Wszyscy użytkownicy mają dostęp do systemu"
          style={{ marginBottom: 16 }}
        />
      )}
      
      <StatusIndicator settings={settings} />
      <SettingsForm settings={settings} onUpdate={fetchSettings} />
    </Card>
  );
};
```

### 2. **Wskaźnik Statusu**

```tsx
// StatusIndicator.tsx
const StatusIndicator: React.FC<{ settings: IpRestrictionSettings }> = ({ settings }) => {
  const getStatusInfo = () => {
    if (!settings.isEnabled) {
      return {
        status: 'Wyłączone',
        color: 'red',
        icon: '🔓',
        description: 'Ograniczenia IP są całkowicie wyłączone'
      };
    }
    
    switch (settings.mode) {
      case 'development':
        return {
          status: 'Tryb Deweloperski',
          color: 'orange',
          icon: '🔧',
          description: 'Localhost automatycznie dozwolony'
        };
      case 'strict':
        return {
          status: 'Tryb Ścisły',
          color: 'green',
          icon: '🔒',
          description: 'Pełne ograniczenia włączone'
        };
      case 'disabled':
        return {
          status: 'Wyłączone (tryb)',
          color: 'gray',
          icon: '⏸️',
          description: 'Wyłączone przez ustawienie trybu'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{statusInfo.icon}</span>
        <Text strong style={{ color: statusInfo.color }}>
          {statusInfo.status}
        </Text>
      </div>
      <Text type="secondary">{statusInfo.description}</Text>
      
      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
        Ostatnia zmiana: {new Date(settings.updatedAt).toLocaleString()} 
        {' przez '} {settings.lastModifiedBy.name.first} {settings.lastModifiedBy.name.last}
      </div>
    </div>
  );
};
```

### 3. **Formularz Ustawień**

```tsx
// SettingsForm.tsx
const SettingsForm: React.FC<{ 
  settings: IpRestrictionSettings; 
  onUpdate: () => void; 
}> = ({ settings, onUpdate }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: any) => {
    setSaving(true);
    try {
      const response = await fetch('/api/ip-restrictions/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      const data = await response.json();
      
      if (data.success) {
        notification.success({
          message: 'Sukces',
          description: data.message
        });
        onUpdate();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      notification.error({
        message: 'Błąd',
        description: 'Nie udało się zaktualizować ustawień'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={settings}
      onFinish={handleSubmit}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="mode"
            label="Tryb Działania"
            tooltip="Określa jak ścisłe są ograniczenia IP"
          >
            <Select>
              <Option value="development">
                🔧 Development - Localhost dozwolony
              </Option>
              <Option value="strict">
                🔒 Strict - Pełne ograniczenia
              </Option>
              <Option value="disabled">
                ⏸️ Disabled - Wyłączone
              </Option>
            </Select>
          </Form.Item>
        </Col>
        
        <Col span={12}>
          <Form.Item
            name="maxUnauthorizedAttemptsPerHour"
            label="Max prób/godzina"
            tooltip="Maksymalna liczba nieautoryzowanych prób dostępu na godzinę"
          >
            <InputNumber min={1} max={1000} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="allowLocalhostInProduction"
            valuePropName="checked"
          >
            <Checkbox>
              Dozwól localhost w produkcji
            </Checkbox>
          </Form.Item>
        </Col>
        
        <Col span={12}>
          <Form.Item
            name="enableDetailedLogging"
            valuePropName="checked"
          >
            <Checkbox>
              Szczegółowe logowanie
            </Checkbox>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="lastChangeDescription"
        label="Opis zmiany"
      >
        <TextArea rows={2} placeholder="Opcjonalny opis wprowadzanych zmian..." />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>
            Zapisz Ustawienia
          </Button>
          <Button onClick={() => form.resetFields()}>
            Anuluj
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
```

### 4. **Szybki Toggle Switch**

```tsx
// QuickToggle.tsx
const QuickToggle: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleQuickToggle = async (checked: boolean) => {
    setLoading(true);
    
    // Pokaż dialog potwierdzenia dla ważnych zmian
    if (!checked) {
      Modal.confirm({
        title: 'Wyłączyć ograniczenia IP?',
        content: 'To pozwoli na dostęp z wszystkich adresów IP. Czy na pewno?',
        okText: 'Tak, wyłącz',
        cancelText: 'Anuluj',
        onOk: async () => {
          await performToggle();
        },
        onCancel: () => {
          setLoading(false);
        }
      });
    } else {
      await performToggle();
    }
  };

  const performToggle = async () => {
    try {
      const response = await fetch('/api/ip-restrictions/settings/toggle', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setEnabled(data.data.isEnabled);
        notification.success({
          message: data.message,
          duration: 2
        });
      }
    } catch (error) {
      notification.error({
        message: 'Błąd przełączania ograniczeń IP'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <SecurityScanOutlined style={{ color: enabled ? 'green' : 'red' }} />
      <Switch
        checked={enabled}
        loading={loading}
        onChange={handleQuickToggle}
        checkedChildren="ON"
        unCheckedChildren="OFF"
      />
      <Text type={enabled ? "success" : "danger"}>
        {enabled ? 'Ograniczenia Aktywne' : 'Ograniczenia Wyłączone'}
      </Text>
    </div>
  );
};
```

## 📊 Dashboard Widget

```tsx
// IpRestrictionWidget.tsx
const IpRestrictionWidget: React.FC = () => {
  const [stats, setStats] = useState(null);

  return (
    <Card size="small" title="Status IP">
      <Statistic
        title="Ograniczenia IP"
        value={stats?.isEnabled ? "Aktywne" : "Wyłączone"}
        prefix={<SecurityScanOutlined />}
        valueStyle={{ color: stats?.isEnabled ? '#3f8600' : '#cf1322' }}
      />
      <div style={{ marginTop: 8, fontSize: 12 }}>
        Tryb: {stats?.mode}
      </div>
    </Card>
  );
};
```

## 🚀 Implementacja w Głównej Aplikacji

### 1. **Dodaj do Menu Administratora**
```tsx
// AdminMenu.tsx
const menuItems = [
  // ... inne pozycje menu
  {
    key: 'ip-restrictions',
    icon: <SecurityScanOutlined />,
    label: 'Ograniczenia IP',
    children: [
      {
        key: 'ip-restrictions-settings',
        label: 'Ustawienia',
      },
      {
        key: 'ip-restrictions-list',
        label: 'Lista IP',
      }
    ]
  }
];
```

### 2. **Dodaj do Dashboardu**
```tsx
// AdminDashboard.tsx
<Row gutter={16}>
  <Col span={6}>
    <IpRestrictionWidget />
  </Col>
  {/* inne widgety */}
</Row>
```

### 3. **Dodaj Quick Toggle do Header**
```tsx
// AppHeader.tsx
<Header>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <div>{/* logo i menu */}</div>
    <div style={{ display: 'flex', gap: 16 }}>
      <QuickToggle />
      {/* inne elementy header */}
    </div>
  </div>
</Header>
```

## 🎯 Funkcjonalności UX

### 1. **Real-time Status**
- WebSocket połączenie dla live updates
- Automatyczne odświeżanie co 30 sekund
- Powiadomienia push o zmianach

### 2. **Bezpieczeństwo UX**
- Dialog potwierdzenia dla krytycznych zmian
- Ostrzeżenia przed wyłączeniem w produkcji
- Informacje o wpływie na użytkowników

### 3. **Monitoring**
- Logi zmian w czasie rzeczywistym
- Historia modyfikacji ustawień
- Alerty o nieautoryzowanych próbach

## 🔧 Konfiguracja Środowiska

```bash
# Uruchom setup
node scripts/setup-ip-settings.js setup

# Sprawdź status
node scripts/setup-ip-settings.js status

# Reset (development)
node scripts/setup-ip-settings.js reset
```

## 📋 Checklist Implementacji

- [ ] Stwórz komponenty React
- [ ] Dodaj do routingu admina
- [ ] Zintegruj z systemem autoryzacji
- [ ] Dodaj powiadomienia/toasty
- [ ] Przetestuj wszystkie scenariusze
- [ ] Dodaj dokumentację użytkownika
- [ ] Skonfiguruj monitoring zmian

---

*Ten system zapewnia pełną kontrolę nad ograniczeniami IP z przyjaznym interfejsem administratora i bezpiecznymi mechanizmami przełączania.* 