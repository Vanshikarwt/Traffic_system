# 1. Base Image - Node.js Environment
FROM node:18-alpine

# 2. Work Directory set karna
WORKDIR /app

# 3. Dependency manifests copy karna
COPY package*.json ./

# 4. Dependencies install karna
RUN npm install

# 5. Baki ka saara frontend code copy karna
COPY . .

# 6. Next.js ka production build taiyar karna
RUN npm run build

# 7. Port expose karna aur start command
EXPOSE 3000
CMD ["npm", "run", "start"]
