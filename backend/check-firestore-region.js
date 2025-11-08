import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkFirestoreRegion() {
  try {
    console.log('🔍 Verificando configuração do Firestore...\n');
    
    // Carregar credenciais
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.resolve(__dirname, '../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json');
    
    const serviceAccountJson = readFileSync(credentialsPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    console.log('📋 Informações do Service Account:');
    console.log('- Project ID:', serviceAccount.project_id);
    console.log('- Client Email:', serviceAccount.client_email);
    console.log('- Auth URI:', serviceAccount.auth_uri);
    console.log('');
    
    // Tentar diferentes configurações
    const configs = [
      {
        name: 'Configuração Padrão',
        options: {
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        }
      },
      {
        name: 'Com Database URL',
        options: {
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
          databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com/`
        }
      }
    ];
    
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      console.log(`🧪 Testando: ${config.name}`);
      
      try {
        // Limpar apps anteriores
        if (admin.apps.length > 0) {
          await Promise.all(admin.apps.map(app => app?.delete()));
        }
        
        // Inicializar com nova config
        const app = admin.initializeApp(config.options, `test-app-${i}`);
        const db = app.firestore();
        
        console.log('✅ App inicializado:', app.name);
        
        // Tentar operação básica
        const testRef = db.collection('test-connection').doc('ping');
        
        // Primeiro tentar ler (menos invasivo)
        console.log('📖 Tentando leitura...');
        const doc = await testRef.get();
        console.log('✅ Leitura bem-sucedida! Documento existe:', doc.exists);
        
        // Se leitura funcionou, tentar escrita
        console.log('✍️ Tentando escrita...');
        await testRef.set({
          timestamp: admin.firestore.Timestamp.now(),
          test: true,
          config: config.name
        });
        console.log('✅ Escrita bem-sucedida!');
        
        // Verificar se foi escrito
        const verifyDoc = await testRef.get();
        if (verifyDoc.exists) {
          console.log('✅ Verificação bem-sucedida:', verifyDoc.data());
          
          // Limpar
          await testRef.delete();
          console.log('✅ Limpeza concluída');
        }
        
        console.log(`🎉 ${config.name} FUNCIONOU!\n`);
        return; // Parar no primeiro que funcionar
        
      } catch (error) {
        console.log(`❌ ${config.name} falhou:`, error.message);
        console.log('Error code:', error.code);
        console.log('');
      }
    }
    
    console.log('❌ Nenhuma configuração funcionou');
    console.log('\n🔍 Possíveis soluções:');
    console.log('1. Verificar se o Firestore está realmente habilitado no projeto');
    console.log('2. Verificar se as regras de segurança permitem escrita');
    console.log('3. Verificar se o service account tem as permissões corretas');
    console.log('4. Tentar criar uma coleção manualmente no Console primeiro');
    
  } catch (error) {
    console.error('💥 Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkFirestoreRegion();
