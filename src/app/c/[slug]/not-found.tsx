import { Marca, Painel, Rotulo } from '@/components/ui'

/** 404 de carta e trafego, nao erro: sempre com CTA de criar a sua. */
export default function NaoEncontrada() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-4 sm:pt-8">
      <header className="flex items-center justify-between pb-4">
        <a href="/" aria-label="VUT">
          <Marca />
        </a>
        <Rotulo tom="warn">carta não encontrada</Rotulo>
      </header>

      <Painel className="p-5">
        <h1 className="text-[18px] font-bold">Essa carta não existe mais.</h1>
        <p className="mt-2 text-[14px] leading-snug text-[var(--dim)]">
          O link pode estar errado ou a carta foi refeita em outra série. Dá pra gerar a sua agora:
          só o Riot ID, o resto a gente descobre.
        </p>
        <a href="/" className="btn btn-primario mt-4 w-full">
          Criar minha carta
        </a>
      </Painel>
    </main>
  )
}
