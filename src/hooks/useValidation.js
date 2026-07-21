import { useState } from 'react';

const DEFAULT_RULES = {
  partes: { min: 3, required: true, label: 'Partes' },
  fundamentacao: { min: 100, required: true, label: 'Fundamentação' },
  pedido: { min: 20, required: true, label: 'Pedido' },
};

export function useValidation(rules = DEFAULT_RULES) {
  const [errors, setErrors] = useState({});

  const validate = (field, value) => {
    const rule = rules[field];
    let result = { valid: true, error: null };

    if (rule) {
      const text = (value || '').trim();
      if (rule.required && !text) {
        result = { valid: false, error: 'Campo obrigatório' };
      } else if (text && rule.min && text.length < rule.min) {
        result = { valid: false, error: `Mínimo de ${rule.min} caracteres (atual: ${text.length})` };
      }
    }

    setErrors((prev) => {
      if (result.valid) {
        if (!(field in prev)) return prev;
        const { [field]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [field]: result.error };
    });

    return result;
  };

  const isAllValid = Object.keys(errors).length === 0;

  return { validate, errors, isAllValid };
}