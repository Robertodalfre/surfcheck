#!/usr/bin/env node

/**
 * Script para migrar do sistema em memória para Firestore
 * Execute: node migrate-to-firestore.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Arquivos a serem substituídos
const migrations = [
  {
    from: 'src/domain/scheduling.model.js',
    to: 'src/domain/scheduling.model.firestore.js',
    backup: 'src/domain/scheduling.model.memory.js'
  },
  {
    from: 'src/services/analytics.service.js',
    to: 'src/services/analytics.service.firestore.js',
    backup: 'src/services/analytics.service.memory.js'
  }
];

// Arquivos de rotas que precisam ser atualizados
const routeUpdates = [
  {
    file: 'src/routes/scheduling.routes.js',
    changes: [
      {
        from: "import {\n  createScheduling,\n  getSchedulingsByUser,\n  getSchedulingById,\n  updateScheduling,\n  deleteScheduling,\n  validateTimeWindows,\n  validateSurfStyle,\n  validateWindPreference\n} from '../domain/scheduling.model.js';",
        to: "import {\n  createScheduling,\n  getSchedulingsByUser,\n  getSchedulingById,\n  updateScheduling,\n  deleteScheduling,\n  validateTimeWindows,\n  validateSurfStyle,\n  validateWindPreference\n} from '../domain/scheduling.model.firestore.js';"
      }
    ]
  },
  {
    file: 'src/routes/analytics.routes.js',
    changes: [
      {
        from: "import {\n  generateUserAnalytics,\n  generateUserMatches,\n  generateUserBadges,\n  recordWindowHistory,\n  seedAnalyticsData,\n  clearAnalyticsData\n} from '../services/analytics.service.js';",
        to: "import {\n  generateUserAnalytics,\n  generateUserMatches,\n  generateUserBadges,\n  recordWindowHistory,\n  seedAnalyticsData,\n  clearAnalyticsData\n} from '../services/analytics.service.firestore.js';"
      }
    ]
  },
  {
    file: 'src/routes/notifications.routes.js',
    changes: [
      {
        from: "} from '../domain/scheduling.model.js';",
        to: "} from '../domain/scheduling.model.firestore.js';"
      }
    ]
  },
  {
    file: 'src/services/window-analysis.service.js',
    changes: [
      {
        from: "import { getSpotById } from '../domain/spots.model.js';",
        to: "import { getSpotById } from '../domain/spots.model.js';"
      }
    ]
  }
];

function backupFile(filePath) {
  const backupPath = filePath.replace('.js', '.backup.js');
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`✅ Backup criado: ${backupPath}`);
    return true;
  }
  return false;
}

function replaceFile(fromPath, toPath) {
  if (fs.existsSync(toPath)) {
    fs.copyFileSync(toPath, fromPath);
    console.log(`✅ Arquivo substituído: ${fromPath}`);
    return true;
  } else {
    console.log(`❌ Arquivo fonte não encontrado: ${toPath}`);
    return false;
  }
}

function updateRouteFile(routeUpdate) {
  const filePath = routeUpdate.file;
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Arquivo de rota não encontrado: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;

  routeUpdate.changes.forEach(change => {
    if (content.includes(change.from)) {
      content = content.replace(change.from, change.to);
      updated = true;
    }
  });

  if (updated) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Rota atualizada: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  Nenhuma alteração necessária em: ${filePath}`);
    return false;
  }
}

function createEnvExample() {
  const envExample = `# Firebase Configuration
FIREBASE_PROJECT_ID=surfcheck-44df4
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nyour_private_key\\n-----END PRIVATE KEY-----\\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@surfcheck-44df4.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Or use service account file path
GOOGLE_APPLICATION_CREDENTIALS=../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json

# Other configs
NODE_ENV=development
LOG_LEVEL=info
CACHE_TTL_MIN=20
`;

  fs.writeFileSync('.env.example', envExample);
  console.log('✅ Arquivo .env.example criado');
}

async function main() {
  console.log('🚀 Iniciando migração para Firestore...\n');

  // 1. Fazer backup dos arquivos originais
  console.log('📦 Criando backups...');
  migrations.forEach(migration => {
    backupFile(migration.from);
  });

  // 2. Substituir arquivos principais
  console.log('\n🔄 Substituindo arquivos...');
  migrations.forEach(migration => {
    replaceFile(migration.from, migration.to);
  });

  // 3. Atualizar imports nas rotas
  console.log('\n📝 Atualizando imports nas rotas...');
  routeUpdates.forEach(routeUpdate => {
    updateRouteFile(routeUpdate);
  });

  // 4. Criar exemplo de .env
  console.log('\n⚙️  Criando configuração...');
  createEnvExample();

  console.log('\n✅ Migração concluída!');
  console.log('\n📋 Próximos passos:');
  console.log('1. Configure suas credenciais Firebase no .env');
  console.log('2. Certifique-se que o Firestore está habilitado');
  console.log('3. Configure as regras de segurança no console Firebase');
  console.log('4. Reinicie o servidor: npm run dev');
  console.log('\n🔙 Para reverter: renomeie os arquivos .backup.js de volta');
}

// Executar migração
main().catch(error => {
  console.error('❌ Erro na migração:', error);
  process.exit(1);
});
