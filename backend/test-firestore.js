import { getFirestore } from './src/utils/firebase.js';

async function testFirestore() {
  try {
    console.log('Testing Firestore connection...');
    console.log('Environment variables:');
    console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅ Set' : '❌ Not set');
    console.log('- FIRESTORE_EMULATOR_HOST:', process.env.FIRESTORE_EMULATOR_HOST || 'Not set (using production)');
    console.log('- FIRESTORE_TIDES_COLLECTION:', process.env.FIRESTORE_TIDES_COLLECTION || 'tides (default)');
    console.log('');
    
    const db = getFirestore();
    console.log('✅ Firestore initialized successfully');
    
    // Test simple read first (less likely to fail)
    console.log('Testing collection access...');
    const testCollection = db.collection('test');
    console.log('✅ Collection reference created');
    
    // Test write
    console.log('Testing document write...');
    const testRef = testCollection.doc('connection-test');
    await testRef.set({
      message: 'Hello from SurfCheck!',
      timestamp: new Date(),
      test: true,
      projectId: 'surfcheck-44df4'
    });
    console.log('✅ Test document written successfully');
    
    // Test read
    console.log('Testing document read...');
    const doc = await testRef.get();
    if (doc.exists) {
      console.log('✅ Test document read successfully:', doc.data());
    } else {
      console.log('❌ Test document not found');
    }
    
    // Clean up
    console.log('Cleaning up test document...');
    await testRef.delete();
    console.log('✅ Test document deleted successfully');
    
    console.log('🎉 Firestore is working correctly!');
    
  } catch (error) {
    console.error('❌ Firestore test failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error details:', error.details);
    
    if (error.message.includes('NOT_FOUND')) {
      console.log('');
      console.log('🔍 Troubleshooting NOT_FOUND error:');
      console.log('1. Verifique se o Firestore está habilitado no projeto Firebase');
      console.log('2. Acesse: https://console.firebase.google.com/project/surfcheck-44df4/firestore');
      console.log('3. Se não existir, clique em "Criar banco de dados"');
      console.log('4. Escolha "Iniciar no modo de teste"');
      console.log('5. Configure as regras de segurança para permitir leitura/escrita');
    }
    
    console.error('Full error:', error);
  }
}

testFirestore();
