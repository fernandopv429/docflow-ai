import { useEffect, useReducer } from 'react';
import { subscribe } from '@/lib/conversaStore';

// Re-renderiza o componente sempre que qualquer sessão do store muda,
// inclusive as que estão rodando em segundo plano.
export default function useConversaStore() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => subscribe(force), []);
}