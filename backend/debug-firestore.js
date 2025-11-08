import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugFirestore() {
  try {
    console.log('🔍 Debug detalhado do Firestore...\n');
    
    // Verificar credenciais
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.resolve(__dirname, '../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json');
    
    console.log('📁 Caminho das credenciais:', credentialsPath);
    
    const serviceAccountJson = readFileSync(credentialsPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    console.log('🔑 Service Account Info:');
    console.log('- Project ID:', serviceAccount.project_id);
    console.log('- Client Email:', serviceAccount.client_email);
    console.log('- Private Key ID:', serviceAccount.private_key_id?.substring(0, 8) + '...');
    console.log('');
    
    // Inicializar Firebase Admin
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    
    const db = admin.firestore();
    console.log('✅ Firebase Admin inicializado');
    
    // Verificar configurações do Firestore
    console.log('🗄️ Configurações do Firestore:');
    console.log('- App Name:', admin.app().name);
    console.log('- Project ID:', admin.app().options.projectId);
    
    // Teste 1: Listar coleções (mais básico)
    console.log('\n📋 Teste 1: Listando coleções...');
    try {
      const collections = await db.listCollections();
      console.log('✅ Coleções encontradas:', collections.map(c => c.id));
    } catch (error) {
      console.log('❌ Erro ao listar coleções:', error.message);
      console.log('Error code:', error.code);
    }
    
    // Teste 2: Tentar ler um documento (sem escrever)
    console.log('\n📖 Teste 2: Tentando ler documento...');
    try {
      const testRef = db.collection('test').doc('read-test');
      const doc = await testRef.get();
      console.log('✅ Leitura bem-sucedida. Documento existe:', doc.exists);
    } catch (error) {
      console.log('❌ Erro na leitura:', error.message);
      console.log('Error code:', error.code);
      
      if (error.code === 7) {
        console.log('🚫 PERMISSION_DENIED: Verifique as regras de segurança do Firestore');
      }
    }
    
    // Teste 3: Tentar escrever
    console.log('\n✍️ Teste 3: Tentando escrever documento...');
    try {
      const testRef = db.collection('test').doc('write-test');
      await testRef.set({
        message: 'Debug test',
        timestamp: admin.firestore.Timestamp.now(),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Escrita bem-sucedida!');
      
      // Verificar se foi escrito
      const doc = await testRef.get();
      if (doc.exists) {
        console.log('✅ Documento confirmado:', doc.data());
        
        // Limpar
        await testRef.delete();
        console.log('✅ Documento removido');
      }
    } catch (error) {
      console.log('❌ Erro na escrita:', error.message);
      console.log('Error code:', error.code);
      console.log('Error details:', error.details);
      
      if (error.code === 5) {
        console.log('\n🔍 Possíveis causas do NOT_FOUND:');
        console.log('1. Banco de dados não foi criado corretamente');
        console.log('2. Região do banco diferente da esperada');
        console.log('3. Project ID incorreto no service account');
        console.log('4. Firestore não habilitado no projeto');
      }
      
      if (error.code === 7) {
        console.log('\n🔍 PERMISSION_DENIED - Regras de segurança:');
        console.log('1. Acesse: https://console.firebase.google.com/project/surfcheck-44df4/firestore/rules');
        console.log('2. Mude as regras para: allow read, write: if true;');
        console.log('3. Clique em "Publicar"');
      }
    }
    
    console.log('\n🎯 Debug concluído!');
    
  } catch (error) {
    console.error('💥 Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugFirestore();
