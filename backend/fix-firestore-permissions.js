import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixFirestorePermissions() {
  try {
    console.log('🔧 Tentando corrigir permissões do Firestore...\n');
    
    // Carregar credenciais
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.resolve(__dirname, '../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json');
    
    console.log('📁 Carregando credenciais de:', credentialsPath);
    
    const serviceAccountJson = readFileSync(credentialsPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    console.log('🔑 Service Account carregado:');
    console.log('- Project ID:', serviceAccount.project_id);
    console.log('- Client Email:', serviceAccount.client_email);
    console.log('- Private Key ID:', serviceAccount.private_key_id);
    console.log('');
    
    // Limpar apps existentes
    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map(app => app?.delete()));
    }
    
    // Inicializar com configuração mínima
    console.log('🚀 Inicializando Firebase Admin...');
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    console.log('✅ Firebase Admin inicializado');
    
    // Tentar acessar Firestore
    console.log('🗄️ Obtendo instância do Firestore...');
    const db = app.firestore();
    
    // Configurar settings básicos
    db.settings({
      ignoreUndefinedProperties: true
    });
    
    console.log('✅ Firestore configurado');
    
    // Tentar operação mais básica possível - listar coleções
    console.log('📋 Tentando listar coleções...');
    try {
      const collections = await db.listCollections();
      console.log('✅ Coleções encontradas:', collections.map(c => c.id));
      
      if (collections.length === 0) {
        console.log('⚠️ Nenhuma coleção encontrada. Vamos criar uma...');
        
        // Tentar criar uma coleção simples
        console.log('📝 Criando coleção de teste...');
        const testRef = db.collection('firestore-test').doc('connection-test');
        
        await testRef.set({
          message: 'Teste de conexão',
          timestamp: admin.firestore.Timestamp.now(),
          success: true
        });
        
        console.log('✅ Coleção criada com sucesso!');
        
        // Verificar se foi criada
        const doc = await testRef.get();
        if (doc.exists) {
          console.log('✅ Documento verificado:', doc.data());
        }
        
        console.log('🎉 Firestore está funcionando!');
        
      } else {
        console.log('✅ Firestore já tem coleções, testando escrita...');
        
        const testRef = db.collection(collections[0].id).doc('test-write');
        await testRef.set({
          test: true,
          timestamp: admin.firestore.Timestamp.now()
        });
        
        console.log('✅ Escrita bem-sucedida!');
        
        // Limpar
        await testRef.delete();
        console.log('✅ Limpeza concluída');
        
        console.log('🎉 Firestore está funcionando perfeitamente!');
      }
      
    } catch (listError) {
      console.log('❌ Erro ao listar coleções:', listError.message);
      console.log('Error code:', listError.code);
      
      if (listError.code === 7) {
        console.log('\n🔐 PERMISSION_DENIED - Problema de permissões!');
        console.log('Soluções:');
        console.log('1. Acesse: https://console.cloud.google.com/iam-admin/iam?project=surfcheck-44df4');
        console.log('2. Encontre: firebase-adminsdk-fbsvc@surfcheck-44df4.iam.gserviceaccount.com');
        console.log('3. Adicione as permissões:');
        console.log('   - Cloud Datastore User');
        console.log('   - Firebase Admin SDK Administrator Service Agent');
        console.log('   - Editor (ou Owner)');
      }
      
      if (listError.code === 5) {
        console.log('\n🔍 NOT_FOUND - Firestore pode não estar habilitado!');
        console.log('Soluções:');
        console.log('1. Acesse: https://console.firebase.google.com/project/surfcheck-44df4/firestore');
        console.log('2. Se aparecer "Criar banco de dados", clique e crie');
        console.log('3. Escolha "Iniciar no modo de teste"');
        console.log('4. Aguarde a criação completa (pode levar alguns minutos)');
      }
    }
    
  } catch (error) {
    console.error('💥 Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

fixFirestorePermissions();
