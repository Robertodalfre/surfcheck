import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initFirestore() {
  try {
    console.log('🚀 Inicializando Firestore pela primeira vez...\n');
    
    // Carregar credenciais
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.resolve(__dirname, '../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json');
    
    const serviceAccountJson = readFileSync(credentialsPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // Inicializar Firebase Admin
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    
    const db = admin.firestore();
    console.log('✅ Firebase Admin inicializado');
    
    // Criar documento inicial na coleção 'tides' (nossa coleção principal)
    console.log('📝 Criando primeira coleção "tides"...');
    
    const tidesRef = db.collection('tides').doc('init-document');
    await tidesRef.set({
      message: 'Documento inicial para criar a coleção tides',
      createdAt: admin.firestore.Timestamp.now(),
      source: 'init-script',
      temporary: true
    });
    
    console.log('✅ Coleção "tides" criada com sucesso!');
    
    // Criar documento inicial na coleção 'test' (para testes)
    console.log('📝 Criando coleção "test"...');
    
    const testRef = db.collection('test').doc('init-document');
    await testRef.set({
      message: 'Documento inicial para testes',
      createdAt: admin.firestore.Timestamp.now(),
      projectId: serviceAccount.project_id,
      status: 'initialized'
    });
    
    console.log('✅ Coleção "test" criada com sucesso!');
    
    // Verificar se as coleções foram criadas
    console.log('\n📋 Verificando coleções criadas...');
    const collections = await db.listCollections();
    console.log('✅ Coleções disponíveis:', collections.map(c => c.id));
    
    // Testar leitura
    console.log('\n📖 Testando leitura...');
    const testDoc = await testRef.get();
    if (testDoc.exists) {
      console.log('✅ Leitura bem-sucedida:', testDoc.data());
    }
    
    // Limpar documento de teste (manter o de tides para estrutura)
    console.log('\n🧹 Limpando documento de teste...');
    await testRef.delete();
    console.log('✅ Documento de teste removido');
    
    console.log('\n🎉 Firestore inicializado com sucesso!');
    console.log('📌 A coleção "tides" está pronta para receber dados de maré');
    console.log('📌 Agora você pode executar: npm run test-firestore');
    
  } catch (error) {
    console.error('💥 Erro ao inicializar Firestore:', error.message);
    console.error('Stack:', error.stack);
  }
}

initFirestore();
