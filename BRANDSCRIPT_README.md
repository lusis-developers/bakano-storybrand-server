# BrandScript API - Sistema de Generación de Narrativas de Marca

## Descripción General

El sistema BrandScript implementa una versión del framework StoryBrand para generar narrativas de marca efectivas utilizando IA (OpenAI GPT-4 y Google Gemini). Basado en las 8 preguntas fundamentales del StoryBrand, el sistema ayuda a las empresas a crear mensajes claros y convincentes.

## Framework StoryBrand - Las 8 Preguntas Clave

### 1. **A Character (Un Personaje)** - `companyName`
- **Pregunta**: "¿Quién es tu empresa y qué ofreces?"
- **Propósito**: Identificar claramente la empresa y sus productos/servicios
- **Ejemplo**: "Somos una empresa de ropa sostenible para padres conscientes del medio ambiente"

### 2. **Has a Problem (Tiene un Problema)** - `mainProblem`
- **Pregunta**: "¿Cuál es el principal problema que enfrentan tus clientes?"
- **Propósito**: Definir el dolor o frustración que motiva a los clientes
- **Ejemplo**: "Luchan por encontrar ropa de calidad que sea tanto elegante como ecológica"

### 3. **And Meets a Guide (Y Encuentra un Guía)** - `authority`
- **Pregunta**: "¿Qué te hace la autoridad para resolver este problema?"
- **Propósito**: Establecer credibilidad y confianza
- **Ejemplo**: "Con 15 años de experiencia en moda sostenible y certificaciones ecológicas"

### 4. **Who Gives Them a Plan (Que les da un Plan)** - `steps`
- **Pregunta**: "¿Cuáles son los pasos simples que debe seguir el cliente?"
- **Propósito**: Simplificar el proceso para el cliente
- **Ejemplo**: "1. Explora nuestra colección, 2. Elige tu talla, 3. Recibe en casa"

### 5. **And Calls Them to Action (Y los llama a la Acción)** - `solution`
- **Pregunta**: "¿Cómo resuelves específicamente su problema?"
- **Propósito**: Presentar la solución clara y directa
- **Ejemplo**: "Ofrecemos ropa 100% orgánica con diseños modernos y envío gratuito"

### 6. **That Ends in Success (Que termina en Éxito)** - `uniqueCharacteristics`
- **Pregunta**: "¿Qué hace única tu propuesta de valor?"
- **Propósito**: Diferenciarse de la competencia
- **Ejemplo**: "Única marca que combina moda, sostenibilidad y precios accesibles"

### 7. **And Helps Them Avoid Failure (Y les ayuda a evitar el Fracaso)** - `targetAudience`
- **Pregunta**: "¿Quién es específicamente tu audiencia objetivo?"
- **Propósito**: Enfocar el mensaje en el cliente ideal
- **Ejemplo**: "Padres millennials de 25-40 años, ingresos medios-altos, valores ecológicos"

### 8. **Products/Services (Productos/Servicios)** - `productsServices`
- **Pregunta**: "¿Qué productos o servicios específicos ofreces?"
- **Propósito**: Detallar la oferta concreta
- **Ejemplo**: "Ropa casual, formal y deportiva; accesorios; línea infantil"

## Configuración del Sistema

### Variables de Entorno Requeridas

```env
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# Google Gemini Configuration
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-pro
GEMINI_MAX_TOKENS=2000
GEMINI_TEMPERATURE=0.7
```

### Instalación de Dependencias

```bash
# Instalar dependencias con pnpm
pnpm install openai @google/generative-ai

# O con npm
npm install openai @google/generative-ai
```

## API Endpoints

### Autenticación
Todos los endpoints requieren autenticación JWT. Incluir el token en el header:
```
Authorization: Bearer <jwt_token>
```

### 1. Crear BrandScript

**POST** `/api/brandscripts`

```json
{
  "businessId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "answers": {
    "companyName": "EcoFashion Sustainable Clothing",
    "productsServices": "Ropa casual, formal y deportiva sostenible; accesorios ecológicos",
    "targetAudience": "Padres millennials de 25-40 años con ingresos medios-altos y valores ecológicos",
    "mainProblem": "Dificultad para encontrar ropa elegante que sea verdaderamente sostenible",
    "solution": "Ropa 100% orgánica con diseños modernos, certificaciones ecológicas y precios justos",
    "uniqueCharacteristics": "Única marca que combina moda, sostenibilidad total y transparencia en la cadena de suministro",
    "authority": "15 años de experiencia en moda sostenible, certificaciones GOTS y Fair Trade",
    "steps": "1. Explora nuestra colección online, 2. Elige tu talla con nuestra guía, 3. Recibe en casa con envío carbono neutral"
  },
  "aiProvider": "openai" // o "gemini"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "BrandScript creado exitosamente",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
    "business": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "name": "Mi Empresa"
    },
    "answers": { /* respuestas completas */ },
    "generatedScript": "Tu historia de marca comienza con...",
    "aiProvider": "openai",
    "status": "completed",
    "version": 1,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Obtener BrandScripts

**GET** `/api/brandscripts?page=1&limit=10&businessId=64f8a1b2c3d4e5f6a7b8c9d0&status=completed`

**Respuesta:**
```json
{
  "success": true,
  "message": "BrandScripts obtenidos exitosamente",
  "data": {
    "brandScripts": [/* array de brandscripts */],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25,
      "itemsPerPage": 10
    }
  }
}
```

### 3. Obtener BrandScript Específico

**GET** `/api/brandscripts/:id`

### 4. Generar Contenido de Marketing

**POST** `/api/brandscripts/:id/marketing`

```json
{
  "contentType": "email", // "email", "landing", "social", "elevator"
  "aiProvider": "gemini" // opcional
}
```

**Tipos de Contenido Disponibles:**
- **email**: Secuencia de emails de marketing
- **landing**: Contenido para landing page
- **social**: Posts para redes sociales
- **elevator**: Elevator pitch de 30 segundos

### 5. Analizar BrandScript

**POST** `/api/brandscripts/:id/analyze`

```json
{
  "aiProvider": "gemini" // Solo disponible con Gemini por ahora
}
```

### 6. Actualizar Estado

**PATCH** `/api/brandscripts/:id/status`

```json
{
  "status": "archived" // "draft", "completed", "archived"
}
```

### 7. Eliminar BrandScript

**DELETE** `/api/brandscripts/:id`

## Estructura del Modelo de Datos

```typescript
interface IBrandScript {
  business: ObjectId;           // Referencia al negocio
  answers: {                    // Respuestas a las 8 preguntas
    companyName: string;
    productsServices: string;
    targetAudience: string;
    mainProblem: string;
    solution: string;
    uniqueCharacteristics: string;
    authority: string;
    steps: string;
  };
  generatedScript: string;      // BrandScript generado por IA
  aiProvider: 'openai' | 'gemini';
  status: 'draft' | 'completed' | 'archived';
  version: number;              // Control de versiones
  marketingAssets?: {           // Contenido de marketing generado
    email?: string;
    landingPage?: string;
    socialPosts?: string;
    elevatorPitch?: string;
  };
  analysis?: string;            // Análisis del BrandScript
  createdAt: Date;
  updatedAt: Date;
}
```

## Servicios de IA

### OpenAI Service
- **Modelo**: GPT-4
- **Funciones**: Generación de BrandScript y contenido de marketing
- **Fortalezas**: Creatividad, coherencia narrativa

### Gemini Service
- **Modelo**: Gemini Pro
- **Funciones**: Generación, análisis y mejora de BrandScripts
- **Fortalezas**: Análisis detallado, sugerencias de mejora

## Mejores Prácticas

### 1. Completar las 8 Preguntas
- Todas las respuestas son obligatorias
- Ser específico y concreto en cada respuesta
- Evitar jerga técnica innecesaria

### 2. Audiencia Objetivo Clara
- Definir demografía específica
- Incluir psicografía (valores, intereses)
- Ser realista sobre el mercado objetivo

### 3. Problema Real y Urgente
- El problema debe ser genuino y sentido
- Debe ser algo que el cliente quiera resolver YA
- Evitar problemas que el cliente no reconoce

### 4. Solución Clara y Simple
- La solución debe ser fácil de entender
- Debe conectar directamente con el problema
- Evitar múltiples soluciones confusas

### 5. Pasos Simples
- Máximo 3-4 pasos
- Cada paso debe ser claro y accionable
- Eliminar fricción en el proceso

## Ejemplos de Uso

### Ejemplo 1: E-commerce de Ropa Sostenible

```json
{
  "companyName": "EcoStyle - Moda Consciente",
  "productsServices": "Ropa casual y formal sostenible, accesorios ecológicos, línea infantil",
  "targetAudience": "Mujeres profesionales de 28-45 años, ingresos medios-altos, preocupadas por el medio ambiente",
  "mainProblem": "No encuentran ropa profesional que sea elegante, cómoda y verdaderamente sostenible",
  "solution": "Ropa profesional 100% sostenible con diseños modernos y materiales certificados",
  "uniqueCharacteristics": "Única marca que ofrece transparencia total en la cadena de suministro y diseños exclusivos",
  "authority": "10 años en moda sostenible, certificaciones GOTS, colaboraciones con diseñadores reconocidos",
  "steps": "1. Descubre nuestra colección, 2. Prueba virtual con IA, 3. Recibe en 48h con envío neutro en carbono"
}
```

### Ejemplo 2: SaaS para Pequeñas Empresas

```json
{
  "companyName": "BusinessFlow - Gestión Empresarial Inteligente",
  "productsServices": "Software de gestión empresarial, CRM, facturación, inventarios, reportes",
  "targetAudience": "Dueños de pequeñas empresas de 30-55 años, 5-50 empleados, sector servicios",
  "mainProblem": "Pierden tiempo y dinero usando múltiples herramientas desconectadas para gestionar su negocio",
  "solution": "Plataforma todo-en-uno que centraliza la gestión empresarial en una sola herramienta intuitiva",
  "uniqueCharacteristics": "Único software que se adapta automáticamente al tipo de negocio con IA",
  "authority": "Desarrollado por ex-ejecutivos de empresas Fortune 500, usado por +10,000 empresas",
  "steps": "1. Prueba gratuita de 14 días, 2. Configuración automática en 5 minutos, 3. Migra tus datos sin perder información"
}
```

## Troubleshooting

### Errores Comunes

1. **Error 400: Campo requerido faltante**
   - Verificar que todas las 8 respuestas estén completas
   - Revisar que ningún campo esté vacío

2. **Error 500: Error al generar BrandScript**
   - Verificar configuración de API keys
   - Revisar límites de tokens de la API
   - Comprobar conectividad a internet

3. **Error 404: BrandScript no encontrado**
   - Verificar que el ID sea correcto
   - Confirmar que el usuario tenga permisos sobre el negocio

### Logs y Monitoreo

- Los errores se registran en la consola del servidor
- Revisar logs de las APIs de IA para errores específicos
- Monitorear uso de tokens para evitar límites

## Roadmap Futuro

### Funcionalidades Planeadas

1. **Plantillas de Industria**
   - Plantillas pre-configuradas por sector
   - Ejemplos específicos por industria

2. **Colaboración en Equipo**
   - Múltiples usuarios editando BrandScripts
   - Sistema de comentarios y aprobaciones

3. **Integración con Herramientas de Marketing**
   - Exportación a Mailchimp, HubSpot
   - Generación automática de campañas

4. **Analytics y Métricas**
   - Seguimiento de efectividad del mensaje
   - A/B testing de diferentes versiones

5. **IA Mejorada**
   - Entrenamiento con datos específicos de la empresa
   - Sugerencias proactivas de mejora

---

**Nota**: Este sistema está diseñado para ser escalable y mantenible, siguiendo las mejores prácticas de desarrollo backend con TypeScript, Express y MongoDB.