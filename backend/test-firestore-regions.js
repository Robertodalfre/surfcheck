import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testFirestoreRegions() {
  try {
    console.log('🌍 Testando diferentes configurações de região do Firestore...\n');
    
    // Carregar credenciais
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.resolve(__dirname, '../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json');
    
    const serviceAccountJson = readFileSync(credentialsPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // Diferentes configurações para testar
    const configs = [
      {
        name: 'Padrão (sem databaseId)',
        options: {
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        }
      },
      {
        name: 'Database ID: (default)',
        options: {
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
          databaseId: '(default)'
        }
      },
      {
        name: 'Database ID: default',
        options: {
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
          databaseId: 'default'
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
        
        // Tentar diferentes formas de acessar Firestore
        console.log('📊 Tentando app.firestore()...');
        const db1 = app.firestore();
        
        // Configurar settings
        db1.settings({
          ignoreUndefinedProperties: true
        });
        
        // Testar operação básica
        console.log('📋 Tentando listar coleções...');
        const collections = await db1.listCollections();
        console.log('✅ Sucesso! Coleções encontradas:', collections.map(c => c.id));
        
        if (collections.length > 0) {
          // Testar leitura de documento
          console.log('📖 Testando leitura de documento...');
          const firstCollection = collections[0];
          const docs = await firstCollection.limit(1).get();
          console.log('✅ Documentos encontrados:', docs.size);
          
          // Testar escrita
          console.log('✍️ Testando escrita...');
          const testRef = db1.collection('tides').doc('connection-test');
          await testRef.set({
            test: true,
            timestamp: admin.firestore.Timestamp.now(),
            config: config.name,
            success: true
          });
          console.log('✅ Escrita bem-sucedida!');
          
          // Verificar escrita
          const doc = await testRef.get();
          if (doc.exists) {
            console.log('✅ Documento verificado:', doc.data());
          }
          
          console.log(`🎉 ${config.name} FUNCIONOU PERFEITAMENTE!\n`);
          
          // Limpar documento de teste
          await testRef.delete();
          console.log('🧹 Documento de teste removido\n');
          
          return config; // Retornar a configuração que funcionou
        }
        
      } catch (error) {
        console.log(`❌ ${config.name} falhou:`, error.message);
        console.log('Error code:', error.code);
        console.log('');
      }
    }
    
    console.log('❌ Nenhuma configuração funcionou');
    console.log('\n🔧 Possível solução:');
    console.log('O Firestore pode ter sido criado em uma região diferente ou com configurações específicas.');
    console.log('Tente recriar o banco de dados no Firebase Console:');
    console.log('1. Acesse: https://console.firebase.google.com/project/surfcheck-44df4/firestore');
    console.log('2. Clique nas configurações (⚙️) do Firestore');
    console.log('3. Verifique a região e configurações');
    console.log('4. Se necessário, delete e recrie o banco');
    
  } catch (error) {
    console.error('💥 Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFirestoreRegions();
