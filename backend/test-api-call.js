import fetch from 'node-fetch';

console.log('🌊 Testando API com cache...');

try {
  console.log('📡 Fazendo primeira requisição (deve buscar da API)...');
  const response1 = await fetch('http://localhost:4000/forecast/sape?days=1');
  const data1 = await response1.json();
  
  console.log('✅ Primeira requisição concluída');
  console.log(`📊 Cache status: ${data1.cache?.fresh ? 'FRESH (da API)' : 'CACHED'}`);
  console.log(`🏄 Dados de maré: ${data1.hours?.[0]?.tide_height !== null ? 'PRESENTES' : 'AUSENTES'}`);
  
  console.log('\n⏳ Aguardando 2 segundos...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('📡 Fazendo segunda requisição (deve usar cache)...');
  const response2 = await fetch('http://localhost:4000/forecast/sape?days=1');
  const data2 = await response2.json();
  
  console.log('✅ Segunda requisição concluída');
  console.log(`📊 Cache status: ${data2.cache?.fresh ? 'FRESH (da API)' : 'CACHED'}`);
  console.log(`🏄 Dados de maré: ${data2.hours?.[0]?.tide_height !== null ? 'PRESENTES' : 'AUSENTES'}`);
  
  if (!data1.cache?.fresh && !data2.cache?.fresh) {
    console.log('\n🎉 SUCESSO: Cache funcionando perfeitamente!');
  } else if (data1.cache?.fresh && !data2.cache?.fresh) {
    console.log('\n🎉 SUCESSO: Cache salvou na primeira e usou na segunda!');
  } else {
    console.log('\n⚠️  Cache pode não estar funcionando como esperado');
  }
  
} catch (error) {
  console.error('❌ Erro ao testar API:', error.message);
}
