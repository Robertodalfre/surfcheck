import { Firestore } from '@google-cloud/firestore';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDirectFirestore() {
  try {
    console.log('🔥 Testando Firestore direto com @google-cloud/firestore...\n');
    
    // Configurações para testar
    const configs = [
      {
        name: 'Com service account path',
        options: {
          projectId: 'surfcheck-44df4',
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || 
            path.resolve(__dirname, '../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json')
        }
      },
      {
        name: 'Com databaseId default',
        options: {
          projectId: 'surfcheck-44df4',
          databaseId: '(default)',
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || 
            path.resolve(__dirname, '../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json')
        }
      }
    ];
    
    for (const config of configs) {
      console.log(`🧪 Testando: ${config.name}`);
      
      try {
        // Criar instância do Firestore
        const db = new Firestore(config.options);
        
        console.log('✅ Firestore inicializado');
        
        // Testar listagem de coleções
        console.log('📋 Listando coleções...');
        const collections = await db.listCollections();
        console.log('✅ Coleções encontradas:', collections.map(c => c.id));
        
        if (collections.length > 0) {
          // Testar leitura
          console.log('📖 Testando leitura...');
          const tidesCollection = db.collection('tides');
          const snapshot = await tidesCollection.limit(1).get();
          console.log('✅ Documentos na coleção tides:', snapshot.size);
          
          // Testar escrita
          console.log('✍️ Testando escrita...');
          const testDoc = tidesCollection.doc('connection-test');
          await testDoc.set({
            test: true,
            timestamp: new Date(),
            config: config.name,
            success: true
          });
          console.log('✅ Escrita bem-sucedida!');
          
          // Verificar escrita
          const doc = await testDoc.get();
          if (doc.exists) {
            console.log('✅ Documento verificado:', doc.data());
          }
          
          console.log(`🎉 ${config.name} FUNCIONOU!\n`);
          
          // Limpar
          await testDoc.delete();
          console.log('🧹 Documento de teste removido\n');
          
          return config; // Sucesso!
        } else {
          console.log('⚠️ Nenhuma coleção encontrada, mas conexão funcionou');
          
          // Tentar criar uma coleção
          console.log('📝 Criando coleção de teste...');
          const testCollection = db.collection('tides');
          const testDoc = testCollection.doc('init-test');
          await testDoc.set({
            message: 'Primeira conexão bem-sucedida',
            timestamp: new Date(),
            config: config.name
          });
          console.log('✅ Coleção criada com sucesso!');
          
          // Verificar
          const doc = await testDoc.get();
          if (doc.exists) {
            console.log('✅ Documento criado:', doc.data());
          }
          
          console.log(`🎉 ${config.name} FUNCIONOU E CRIOU A COLEÇÃO!\n`);
          return config;
        }
        
      } catch (error) {
        console.log(`❌ ${config.name} falhou:`, error.message);
        console.log('Error code:', error.code);
        console.log('');
      }
    }
    
    console.log('❌ Nenhuma configuração funcionou com @google-cloud/firestore');
    
  } catch (error) {
    console.error('💥 Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDirectFirestore();
