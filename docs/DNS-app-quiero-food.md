# DNS: app.quiero.food não resolve

## Diagnóstico (testado em 04/03/2026)

```bash
$ dig app.quiero.food +short
# (vazio – nenhum registro DNS)

$ dig kds.quiero.food +short
216.150.1.65
216.150.1.1
```

**Conclusão:** `app.quiero.food` **não tem registro DNS** (não resolve). O wildcard `*.quiero.food` na Vercel não cria o registro sozinho no provedor de DNS; muitos provedores não incluem o subdomínio `app` no wildcard ou têm regra especial para `app`.

## Correção no Namecheap

1. Acesse **Namecheap** → **Domain List** → **Manage** no domínio **quiero.food**.
2. Abra **Advanced DNS**.
3. Adicione um registro **CNAME**:
   - **Type:** CNAME
   - **Host:** `app`
   - **Value:** `cname.vercel-dns.com`
   - **TTL:** Automatic (ou 300)
4. Salve e aguarde a propagação (minutos a ~24h).

Depois, confira:

```bash
dig app.quiero.food +short
# Deve retornar um CNAME para cname.vercel-dns.com ou IPs da Vercel
```

## Referência

- Na Vercel, **app.quiero.food** e **\*.quiero.food** já estão em "Valid Configuration".
- O problema era apenas a resolução DNS no provedor (Namecheap); o subdomínio `app` precisa de registro explícito.
