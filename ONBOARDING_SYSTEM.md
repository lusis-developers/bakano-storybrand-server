# Sistema de Onboarding Profesional

## Descripción General

El sistema de onboarding profesional de Bakano StoryBrand está diseñado para capturar información contextual detallada tanto del usuario como del negocio, permitiendo personalizar la experiencia y generar contenido más relevante y efectivo.

## Arquitectura del Sistema

### Modelo de Datos

El sistema se basa en tres componentes principales:

1. **Perfil del Usuario (IUserProfile)**
   - Información profesional y demográfica
   - Experiencia en marketing
   - Objetivos y puntos de dolor
   - Preferencias de comunicación

2. **Contexto del Negocio (IBusinessContext)**
   - Etapa y tamaño de la empresa
   - Industria y mercados objetivo
   - Madurez de marca y presupuesto
   - Canales de marketing actuales

3. **Preferencias de Onboarding (IOnboardingPreferences)**
   - Configuraciones de notificaciones
   - Tipos de contenido preferidos
   - Frecuencia de comunicación
   - Progreso del onboarding

## Endpoints de la API

### Autenticación
Todos los endpoints requieren autenticación mediante Bearer Token.

```
Authorization: Bearer <token>
```

### 1. Crear Onboarding

**POST** `/api/onboarding`

```json
{
  "businessId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "userProfile": {
    "jobTitle": "Marketing Manager",
    "department": "marketing",
    "experienceLevel": "intermediate",
    "marketingExperience": "intermediate",
    "primaryGoals": ["brand_awareness", "lead_generation"],
    "painPoints": ["lack_of_time", "unclear_messaging"],
    "preferredCommunicationStyle": "professional",
    "timezone": "America/Mexico_City",
    "workingHours": {
      "start": "09:00",
      "end": "18:00"
    }
  },
  "businessContext": {
    "businessStage": "growth",
    "companySize": "11-50",
    "targetMarket": "b2b",
    "primaryIndustry": "Technology",
    "secondaryIndustries": ["SaaS", "Consulting"],
    "geographicMarkets": ["Mexico", "Latin America"],
    "competitiveAdvantage": "Única plataforma que integra IA con análisis predictivo",
    "brandMaturity": "developing",
    "marketingBudget": "5k_25k",
    "currentMarketingChannels": ["social_media", "email", "content_marketing"],
    "marketingChallenges": ["inconsistent_messaging", "low_engagement"],
    "contentCreationFrequency": "weekly",
    "brandVoice": "professional"
  },
  "preferences": {
    "communicationFrequency": "weekly",
    "preferredContentTypes": ["blog_posts", "social_media", "email_campaigns"],
    "aiProviderPreference": "openai",
    "notificationSettings": {
      "email": true,
      "inApp": true,
      "contentGenerated": true,
      "weeklyReports": true,
      "systemUpdates": false
    }
  }
}
```

### 2. Obtener Onboarding

**GET** `/api/onboarding/:businessId`

Respuesta:
```json
{
  "message": "Onboarding retrieved successfully.",
  "onboarding": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
    "user": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "juan@empresa.com"
    },
    "business": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "name": "TechCorp",
      "industry": "Technology"
    },
    "userProfile": { /* ... */ },
    "businessContext": { /* ... */ },
    "preferences": { /* ... */ },
    "completionPercentage": 75,
    "startedAt": "2024-01-15T10:00:00.000Z",
    "lastUpdated": "2024-01-15T14:30:00.000Z"
  },
  "nextStep": "first_content",
  "isComplete": false
}
```

### 3. Actualizar Onboarding

**PUT** `/api/onboarding/:businessId`

```json
{
  "userProfile": {
    "primaryGoals": ["brand_awareness", "lead_generation", "sales_conversion"]
  },
  "completedStep": "preferences"
}
```

### 4. Obtener Todos los Onboardings del Usuario

**GET** `/api/onboarding`

### 5. Completar Paso del Onboarding

**POST** `/api/onboarding/:businessId/complete-step`

```json
{
  "step": "user_profile"
}
```

Pasos válidos:
- `user_profile`
- `business_context`
- `preferences`
- `first_content`

### 6. Eliminar Onboarding

**DELETE** `/api/onboarding/:businessId`

## Servicio de Onboarding

El `OnboardingService` proporciona funcionalidades avanzadas:

### Recomendaciones Personalizadas

```typescript
const recommendations = OnboardingService.generatePersonalizedRecommendations(
  userProfile,
  businessContext
);
```

Genera:
- Tipos de contenido recomendados
- Canales de marketing sugeridos
- Proveedor de IA recomendado
- Frecuencia de comunicación óptima
- Características prioritarias

### Insights de Onboarding

```typescript
const insights = OnboardingService.generateOnboardingInsights(
  userProfile,
  businessContext
);
```

Proporciona:
- Persona del usuario
- Nivel de madurez del negocio
- Preparación para marketing
- Punto de inicio recomendado
- Tiempo estimado para ver valor
- Factores de riesgo y éxito

### Analytics de Onboarding

```typescript
const analytics = await OnboardingService.getOnboardingAnalytics();
```

Incluye:
- Total de onboardings
- Tasa de completación
- Tiempo promedio de completación
- Puntos de dolor comunes
- Distribución por industria y departamento

## Flujo de Onboarding Recomendado

### 1. Registro del Usuario
```
POST /api/auth/register
```

### 2. Creación del Negocio
```
POST /api/business
```

### 3. Inicio del Onboarding
```
POST /api/onboarding
```

### 4. Completar Pasos Progresivamente
```
POST /api/onboarding/:businessId/complete-step
```

### 5. Generar Primer Contenido
```
POST /api/content
```

## Personalización Basada en Onboarding

El sistema utiliza la información del onboarding para:

1. **Personalizar Prompts de IA**
   - Adaptar el tono según `brandVoice`
   - Ajustar complejidad según `experienceLevel`
   - Enfocar en `primaryGoals`

2. **Recomendar Funcionalidades**
   - Mostrar características relevantes según `painPoints`
   - Sugerir integraciones según `currentMarketingChannels`
   - Priorizar tipos de contenido según `preferredContentTypes`

3. **Optimizar Experiencia**
   - Ajustar frecuencia de notificaciones
   - Personalizar dashboard según rol
   - Adaptar flujos de trabajo

## Ejemplos de Uso

### Startup Tecnológica
```json
{
  "businessStage": "startup",
  "primaryGoals": ["brand_awareness", "lead_generation"],
  "marketingBudget": "under_1k",
  "painPoints": ["lack_of_time", "limited_budget"]
}
```
**Recomendaciones**: Contenido orgánico, redes sociales, automatización

### Empresa Establecida
```json
{
  "businessStage": "established",
  "primaryGoals": ["sales_conversion", "customer_retention"],
  "marketingBudget": "25k_100k",
  "painPoints": ["low_conversion_rates", "measuring_roi"]
}
```
**Recomendaciones**: Campañas pagadas, email marketing, análisis avanzado

## Beneficios del Sistema

1. **Personalización Profunda**: Contenido adaptado al contexto específico
2. **Eficiencia Mejorada**: Recomendaciones precisas desde el inicio
3. **Mejor Adopción**: Experiencia guiada y relevante
4. **Insights Valiosos**: Datos para mejorar el producto
5. **Escalabilidad**: Sistema automatizado de personalización

## Consideraciones de Implementación

- **Privacidad**: Toda la información está protegida y asociada al usuario
- **Flexibilidad**: El onboarding puede completarse en múltiples sesiones
- **Progresividad**: Cada paso agrega valor incremental
- **Validación**: Validaciones estrictas en todos los endpoints
- **Seguridad**: Autenticación requerida en todas las operaciones

## Próximos Pasos

1. Implementar dashboard de onboarding en frontend
2. Agregar wizard paso a paso
3. Integrar recomendaciones en generación de contenido
4. Desarrollar analytics avanzados
5. Implementar A/B testing para optimizar flujo