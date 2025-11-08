import fetch from 'node-fetch';

console.log('🌊 Testando uma única requisição...');

try {
  console.log('📡 Fazendo requisição para http://localhost:4000/forecast/sape?days=1');
  const response = await fetch('http://localhost:4000/forecast/sape?days=1');
  const data = await response.json();
  
  console.log('✅ Requisição concluída');
  console.log(`📊 Cache status: ${data.cache?.fresh ? 'FRESH (da API)' : 'CACHED'}`);
  console.log(`🏄 Dados de maré presentes: ${data.hours?.[0]?.tide_height !== null ? 'SIM' : 'NÃO'}`);
  console.log(`📈 Total de horas: ${data.hours?.length || 0}`);
  
  if (data.hours?.[0]) {
    const firstHour = data.hours[0];
    console.log(`🌊 Primeira hora - Maré: ${firstHour.tide_height}m, Onda: ${firstHour.wave_height}m`);
  }
  
} catch (error) {
  console.error('❌ Erro ao testar API:', error.message);
}
