import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-destructive rounded-full p-3">
              <ShieldAlert className="h-6 w-6 text-destructive-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Acesso Negado</CardTitle>
          <CardDescription className="text-center">
            Você não tem permissão para acessar esta página.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={() => navigate(-1)} variant="outline">
            Voltar
          </Button>
          <Button onClick={() => navigate('/login')}>
            Ir para Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
