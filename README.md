# Scidist

Scidist es un proyecto de software desarrollado de manera colaborativa con el objetivo de implementar una arquitectura distribuida compuesta por diferentes servicios y una interfaz gráfica para la interacción con el sistema.

El proyecto integra una aplicación frontend con distintos servicios del sistema, separando las responsabilidades de la interfaz, la comunicación y el procesamiento mediante una estructura modular.

## Características principales

- Arquitectura distribuida basada en servicios.
- Separación entre frontend y servicios del sistema.
- Interfaz gráfica para facilitar la interacción del usuario.
- Comunicación entre diferentes componentes del sistema.
- Definición de estructuras y mecanismos de comunicación mediante archivos Protocol Buffers.
- Organización modular del código.
- Configuración para ejecución mediante contenedores.
- Desarrollo colaborativo utilizando Git y GitHub.

## Estructura del proyecto

```text
Scidist-archive/
│
├── Frontend/
│   └── scidist-frontend/
│       └── Aplicación e interfaz de usuario
│
├── proto/
│   └── Definiciones utilizadas para la comunicación entre servicios
│
├── services/
│   └── Servicios y lógica del sistema distribuido
│
├── .dockerignore
├── .gitignore
└── README.md
```

### Frontend

La carpeta `Frontend/scidist-frontend` contiene la interfaz de usuario del proyecto.

Esta parte permite que el usuario interactúe con las funcionalidades proporcionadas por el sistema distribuido mediante una interfaz visual, manteniendo separada la capa de presentación de los servicios responsables del procesamiento.

### Services

La carpeta `services` contiene los diferentes componentes encargados de implementar la lógica y procesamiento del sistema.

La separación en servicios permite distribuir responsabilidades y mantener una arquitectura modular.

### Protocol Buffers

La carpeta `proto` contiene las definiciones utilizadas para establecer la estructura de comunicación entre diferentes componentes del sistema.

Esto permite definir de manera consistente los mensajes y operaciones utilizados por los servicios.

## Arquitectura general

El proyecto sigue una estructura en la que el frontend funciona como punto de interacción con el usuario y se comunica con los diferentes servicios encargados de procesar las solicitudes.

De manera simplificada:

```text
                Usuario
                   |
                   v
          +------------------+
          |     Frontend     |
          | Interfaz gráfica |
          +------------------+
                   |
                   v
          +------------------+
          | Comunicación     |
          | entre servicios  |
          +------------------+
                   |
          +--------+--------+
          |                 |
          v                 v
     +---------+       +---------+
     |Servicio |       |Servicio |
     |    A    |       |    B    |
     +---------+       +---------+
          |                 |
          +--------+--------+
                   |
                   v
             Procesamiento
```

Esta separación permite mantener una estructura organizada y facilita el desarrollo independiente de los distintos componentes.

## Tecnologías y herramientas

El proyecto utiliza diferentes tecnologías y herramientas para el desarrollo de la interfaz, los servicios y la comunicación entre componentes.

Entre ellas se encuentran:

- JavaScript
- Protocol Buffers
- Docker
- Git
- GitHub
- Arquitectura basada en servicios

## Objetivo académico

Scidist fue desarrollado como un proyecto académico orientado a poner en práctica conceptos relacionados con sistemas distribuidos, comunicación entre servicios, desarrollo frontend, modularidad y trabajo colaborativo.

El proyecto permitió integrar diferentes componentes dentro de una misma solución y trabajar con una arquitectura más cercana a la utilizada en aplicaciones distribuidas reales.

## Colaboradores

Este proyecto fue desarrollado de manera colaborativa.

- **Alex Vera** — Desarrollo de servicios y componentes del sistema.
- **Fátima Mentado Girón** — Desarrollo del frontend y diseño de la interfaz de usuario.

## Contribución al frontend

El desarrollo del frontend y el diseño de la interfaz de usuario estuvieron a cargo de **Fátima Mentado Girón**.

Esta parte del proyecto se enfocó en proporcionar una interfaz visual que permitiera interactuar con las funcionalidades del sistema distribuido, organizando la presentación de información y la interacción del usuario con los diferentes servicios.

## Repositorio

El código fuente completo del proyecto se encuentra disponible en este repositorio y conserva el historial de desarrollo y colaboración realizado durante su implementación.
