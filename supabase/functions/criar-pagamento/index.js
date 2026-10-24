// Edge Function: cria o pedido (preço calculado no banco) e a página de pagamento do Mercado Pago.
// As regras estão em _compartilhado/pagamentos.js; aqui só liga a função ao Supabase e ao Mercado Pago.
import { criarPagamento } from '../_compartilhado/pagamentos.js'
import { criarDependencias } from '../_compartilhado/servicos.js'

const deps = criarDependencias()

Deno.serve((req) => criarPagamento(req, deps))
