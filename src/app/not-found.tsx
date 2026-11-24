import { Marca, Painel, Rotulo } from '@/components/ui'

export default function NaoEncontrada() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-4 sm:pt-8">
      <header className="flex items-center justify-between pb-4">
        <a href="/" aria-label="VUT">
          <Marca />
        </a>
        <Rotulo tom="warn">404</Rotulo>
      </header>
      <Painel className="p-5">
        <h1 className="text-[18px] font-bold">Página não encontrada.</h1>
        <a href="/" className="btn btn-primario mt-4 w-full">
          Criar minha carta
        </a>
      </Painel>
    </main>
  )
}
