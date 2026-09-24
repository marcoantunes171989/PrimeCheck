select 
      tab_fornecedor.cod_fornecedor,
      tab_fornecedor.des_fornecedor,
      tab_fornecedor.des_fantasia,
      tab_fornecedor.num_cgc,
      tab_fornecedor.num_insc_est,
      tab_fornecedor.des_endereco,
      tab_fornecedor.des_bairro,
      tab_cidade.des_cidade,
      tab_cidade.des_sigla,
      tab_fornecedor.num_cep,
      tab_fornecedor.num_fone,
      tab_fornecedor.num_fax,
      tab_fornecedor.des_contato,
      tab_fornecedor.num_prazo,
      tab_fornecedor.des_observacao,
      tab_fornecedor.des_email,
      tab_fornecedor.des_web,
      tab_loja_fornecedor.inativo,
      tab_fornecedor.dta_cadastro,
      tab_fornecedor.des_email_vend,
      tab_fornecedor.senha_cotacao,
      tab_fornecedor.num_celular
from tab_fornecedor
inner join tab_cidade
on (tab_fornecedor.cod_cidade = tab_cidade.cod_cidade)
inner join tab_loja_fornecedor
on tab_loja_fornecedor.cod_fornecedor = tab_fornecedor.cod_fornecedor;
