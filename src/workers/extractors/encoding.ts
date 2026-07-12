// Sistemas contábeis brasileiros exportam CSV em Windows-1252 (CP1252).
// Abrir como UTF-8 vira "Per�odo"/"Classifica��o" e quebra a classificação
// por nome. Detecta e transcodifica de forma determinística.

/** true se o buffer é UTF-8 válido (decode estrito não lança). */
function isValidUtf8(buffer: ArrayBuffer | Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return true
  } catch {
    return false
  }
}

/**
 * Decodifica texto de origem desconhecida: UTF-8 quando válido; senão
 * Windows-1252 (superset do ISO-8859-1 usado pelos ERPs contábeis).
 */
export function decodeSmart(buffer: ArrayBuffer | Uint8Array): {
  text: string
  encoding: 'utf-8' | 'windows-1252'
} {
  if (isValidUtf8(buffer)) {
    return {
      text: new TextDecoder('utf-8').decode(buffer),
      encoding: 'utf-8',
    }
  }
  return {
    text: new TextDecoder('windows-1252').decode(buffer),
    encoding: 'windows-1252',
  }
}
