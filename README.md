<p align="center">
  <a href="#" target="_blank">
    <img src="./assets/logo.png" width="120" alt="Project Logo" />
  </a>
</p>

<h1 align="center">POS Backend API</h1>

<p align="center">
  Backend system for a small coffee shop POS<br/>
  Built with <b>NestJS</b> and modern backend architecture
</p>

<p align="center">
  Developed by a student from<br/>
  <b>Khon Kaen University</b><br/>
  <b>College of Computing</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-v10-red" />
  <img src="https://img.shields.io/badge/Node.js-v18+-green" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-blue" />
  <img src="https://img.shields.io/badge/Auth-JWT%20%2B%20Cookie-orange" />
</p>

---

## 🚀 Description

This project is a **Backend API for a Point of Sale (POS) system** designed for small coffee shops.  
It handles core business operations such as authentication, employee management, menu management, sales processing, and inventory-related data.

The system is built using **NestJS**, following a modular and scalable architecture suitable for real-world applications and academic projects.

---

## 🧩 Features

- 🔐 Authentication & Authorization (JWT + Cookie)
- 👤 Employee & Role Management (Admin / Staff)
- 📋 Menu & Category Management
- 🧾 Sales & Order Processing
- 🧂 Ingredient & Supplier Management
- 🎁 Promotion Management
- 🏗 Modular Architecture (NestJS Modules)
- 🛡 Guards & Decorators for access control

---

## 🛠 Tech Stack

- **Framework:** NestJS
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** TypeORM
- **Authentication:** JWT + HTTP Cookies
- **Environment:** Node.js

---

## 📂 Project Structure

```text
src/
├── auth/
├── employees/
├── categories/
├── menu/
├── sales/
├── ingredients/
├── suppliers/
├── promotions/
├── common/
└── db/
```

---

## ⚙️ Project Setup

```bash
npm install
```

---

## ▶️ Running the Application

```bash
# development
npm run start

# watch mode
npm run start:dev

# production
npm run start:prod
```

Server will start at:
```
http://localhost:3000
```

---

## 🧪 Testing

```bash
npm run test
npm run test:e2e
npm run test:cov
```

---

## 🚢 Deployment

This project is intended for **educational and academic purposes**  
and can be deployed using platforms such as Render, Railway, or Docker.

---

## 📄 License

This project was developed by a student from  
**Khon Kaen University, College of Computing**  
for educational and academic purposes.

<p align="center">
  Developed with ❤️ using NestJS
</p>
