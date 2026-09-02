import { RouterProvider } from 'react-router'
import { Providers } from '@/app/providers'
import { router } from '@/app/router'
import { Abertura } from '@/app/abertura'

export default function App() {
  return (
    <Providers>
      <Abertura />
      <RouterProvider router={router} />
    </Providers>
  )
}
