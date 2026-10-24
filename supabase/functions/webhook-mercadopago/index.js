// Edge Function: recebe os avisos do Mercado Pago e atualiza o pedido (libera ou remove o acesso).
// As regras estão em _compartilhado/pagamentos.js; aqui só liga a função ao Supabase e ao Mercado Pago.
import { receberAviso } from '../_compartilhado/pagamentos.js'
import { criarDependencias } from '../_compartilhado/servicos.js'

const deps = criarDependencias()

Deno.serve((req) => receberAviso(req, deps))
