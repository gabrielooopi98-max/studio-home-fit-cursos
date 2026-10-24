// Edge Function: confere um pedido direto no Mercado Pago (volta do pagamento) ou todos os
// pendentes (painel de ADM / rotina agendada). Regras em _compartilhado/pagamentos.js.
import { conferirPagamento } from '../_compartilhado/pagamentos.js'
import { criarDependencias } from '../_compartilhado/servicos.js'

const deps = criarDependencias()

Deno.serve((req) => conferirPagamento(req, deps))
