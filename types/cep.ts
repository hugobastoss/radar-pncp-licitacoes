export interface Endereco {
  cep: string;
  uf: string;
  cidade: string;
  bairro?: string;
  logradouro?: string;
  codigoIbge?: string;
  latitude?: string;
  longitude?: string;
}
