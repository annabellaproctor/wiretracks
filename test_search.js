import { searchEasyEDAParts, searchLCSCParts } from './src/utils/partsApi.js';

(async () => {
  const query = 'ESP32-C5-DevKitC-1-N8R8';
  console.log('EasyEDA results:');
  try {
    const res1 = await searchEasyEDAParts(query);
    console.log(JSON.stringify(res1, null, 2));
  } catch (e) {
    console.error(e);
  }

  console.log('LCSC results:');
  try {
    const res2 = await searchLCSCParts(query);
    console.log(JSON.stringify(res2, null, 2));
  } catch (e) {
    console.error(e);
  }
})();
