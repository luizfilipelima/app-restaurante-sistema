# 💻 Comandos Úteis

Referência rápida de comandos para desenvolvimento e manutenção do sistema.

---

## 🚀 Desenvolvimento

### Iniciar o projeto
```bash
npm run dev
```
Inicia o servidor de desenvolvimento na porta 5173

### Build para produção
```bash
npm run build
```
Gera os arquivos otimizados na pasta `dist/`

### Preview do build
```bash
npm run preview
```
Testa o build de produção localmente

### Linting
```bash
npm run lint
```
Verifica erros de código com ESLint

---

## 📦 Instalação

### Primeira vez
```bash
# Instalar todas as dependências
npm install

# Copiar arquivo de ambiente
cp .env.example .env

# Editar .env com suas credenciais
nano .env  # ou use seu editor preferido
```

### Adicionar nova dependência
```bash
# Produção
npm install nome-do-pacote

# Desenvolvimento
npm install -D nome-do-pacote
```

---

## 🗄️ Supabase

### Executar schema SQL
```bash
# 1. Copie o conteúdo de supabase/db/schema/initial.sql
cat supabase/db/schema/initial.sql

# 2. Cole no SQL Editor do Supabase e execute
```

### Criar Super Admin
```sql
-- No SQL Editor do Supabase
SELECT create_super_admin('seu@email.com', 'user-uid-aqui');
```

### Verificar usuários
```sql
-- Ver todos os usuários
SELECT * FROM users;

-- Ver usuários de um restaurante específico
SELECT * FROM users WHERE restaurant_id = 'restaurant-id';
```

### Listar restaurantes
```sql
SELECT id, name, slug, is_active FROM restaurants;
```

### Criar usuário admin de restaurante
```sql
INSERT INTO users (id, email, role, restaurant_id)
VALUES (
  'user-uid-from-auth',
  'admin@restaurante.com',
  'restaurant_admin',
  'restaurant-id-here'
);
```

### Criar usuário de cozinha
```sql
INSERT INTO users (id, email, role, restaurant_id)
VALUES (
  'user-uid-from-auth',
  'cozinha@restaurante.com',
  'kitchen',
  'restaurant-id-here'
);
```

### Ver pedidos recentes
```sql
SELECT 
  id,
  customer_name,
  total,
  status,
  created_at
FROM orders
WHERE restaurant_id = 'restaurant-id'
ORDER BY created_at DESC
LIMIT 10;
```

### Ativar Realtime para uma tabela
```sql
-- No Supabase: Database > Replication
-- Ou via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
```

---

## 🐛 Debug

### Ver logs do Vite
```bash
npm run dev -- --debug
```

### Limpar cache do Vite
```bash
rm -rf node_modules/.vite
npm run dev
```

### Ver versões dos pacotes
```bash
npm list --depth=0
```

### Atualizar dependências
```bash
# Verificar atualizações disponíveis
npm outdated

# Atualizar todos os pacotes (cuidado!)
npm update

# Atualizar um pacote específico
npm install nome-do-pacote@latest
```

---

## 🌐 Git

### Inicializar repositório
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/usuario/repositorio.git
git push -u origin main
```

### Commits frequentes
```bash
# Ver status
git status

# Adicionar arquivos
git add .

# Commit
git commit -m "Descrição das mudanças"

# Push
git push
```

### Criar branch para feature
```bash
git checkout -b feature/nome-da-feature
git push -u origin feature/nome-da-feature
```

### Ver histórico
```bash
git log --oneline --graph --decorate
```

---

## ☁️ Deploy (Vercel)

### Via Vercel CLI
```bash
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy para produção
vercel --prod
```

### Via GitHub
```bash
# 1. Push para GitHub
git push origin main

# 2. No Vercel, importe o repositório
# 3. Configure as variáveis de ambiente
# 4. Deploy automático!
```

### Variáveis de ambiente (Vercel)
```bash
# Via CLI
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# Ou no dashboard: Settings > Environment Variables
```

---

## 🔍 Verificação

### Verificar estrutura do projeto
```bash
# Listar todos os arquivos TypeScript
find src -name "*.tsx" -o -name "*.ts" | sort

# Contar linhas de código
find src -name "*.tsx" -o -name "*.ts" | xargs wc -l

# Ver estrutura de pastas
tree src -L 3  # se tree estiver instalado
```

### Verificar portas em uso
```bash
# Linux/Mac
lsof -i :5173

# Se a porta estiver ocupada
kill -9 $(lsof -t -i:5173)
```

### Verificar variáveis de ambiente
```bash
# Ver se .env existe
ls -la .env

# Ver conteúdo (cuidado, contém credenciais!)
cat .env
```

---

## 🧪 Testes (se implementar futuramente)

### Instalar Jest
```bash
npm install -D jest @testing-library/react @testing-library/jest-dom
```

### Instalar Cypress
```bash
npm install -D cypress
npx cypress open
```

---

## 🛠️ Manutenção

### Limpar tudo e reinstalar
```bash
# Remover node_modules e package-lock.json
rm -rf node_modules package-lock.json

# Reinstalar
npm install
```

### Verificar vulnerabilidades
```bash
npm audit

# Corrigir automaticamente
npm audit fix
```

### Analisar tamanho do bundle
```bash
npm run build

# Ver tamanho dos arquivos
ls -lh dist/assets/
```

---

## 📊 Supabase CLI (Avançado)

### Instalar Supabase CLI
```bash
brew install supabase/tap/supabase  # Mac
# ou
npm install -g supabase
```

### Login
```bash
supabase login
```

### Link com projeto
```bash
supabase link --project-ref seu-project-ref
```

### Gerar types TypeScript
```bash
supabase gen types typescript --linked > src/types/supabase.ts
```

### Backup do banco
```bash
supabase db dump -f backup.sql
```

---

## 🔧 Scripts Personalizados

Adicione ao `package.json` se necessário:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist node_modules/.vite"
  }
}
```

---

## 🆘 Troubleshooting

### Erro: "Cannot find module"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Port 5173 already in use"
```bash
# Linux/Mac
kill -9 $(lsof -t -i:5173)

# Ou mude a porta no vite.config.ts
# server: { port: 3000 }
```

### Erro: "Missing environment variables"
```bash
# Verifique se .env existe
ls -la .env

# Verifique se as variáveis começam com VITE_
cat .env
```

### Erro: "Supabase connection failed"
```bash
# Verifique as credenciais
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# Reinicie o servidor
# Ctrl+C e depois npm run dev
```

### Erro: "Type error in TypeScript"
```bash
# Verificar tipos
npm run type-check

# Ver erro detalhado
npx tsc --noEmit
```

---

## 📱 Comandos Mobile (se desenvolver app mobile)

### React Native
```bash
# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

### Expo
```bash
npx expo start
```

---

## 🎨 Tailwind

### Gerar arquivo de configuração completo
```bash
npx tailwindcss init --full
```

### Adicionar novo plugin
```bash
npm install -D @tailwindcss/forms
# Adicione ao tailwind.config.js: plugins: [require('@tailwindcss/forms')]
```

---

## 📝 Notas

- Sempre rode `npm run dev` antes de começar a desenvolver
- Use `git commit` frequentemente
- Teste localmente antes de fazer push
- Mantenha as dependências atualizadas
- Faça backup do banco de dados regularmente

---

## 🔗 Links Úteis

- [Documentação Vite](https://vitejs.dev/)
- [Documentação React](https://react.dev/)
- [Documentação TypeScript](https://www.typescriptlang.org/)
- [Documentação Tailwind](https://tailwindcss.com/)
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Shadcn/UI](https://ui.shadcn.com/)
- [Documentação Vercel](https://vercel.com/docs)

---

**Dica**: Adicione este arquivo aos seus favoritos para referência rápida! 📌
