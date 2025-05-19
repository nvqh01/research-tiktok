import Signer from './utils/signer.js';

const signer = new Signer(null, null);

export default async function() {

  await signer.init(); // Signer laoded

}

export { signer };
