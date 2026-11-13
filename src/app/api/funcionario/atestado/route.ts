import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadFileToDrive } from '@/lib/google-drive';
import { appendAtestado } from '@/lib/google-sheets';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const dataAtestado = formData.get('dataAtestado') as string | null;

  if (!file || !dataAtestado) {
    return NextResponse.json({ error: 'Arquivo e data são obrigatórios.' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Formato inválido. Use PDF, JPG ou PNG.' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5 MB.' }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAtestado)) {
    return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop() ?? 'bin';
  const cleanCpf = session.user.cpf.replace(/\D/g, '');
  const nomeArquivo = `atestado-${cleanCpf}-${Date.now()}.${ext}`;

  const { fileId } = await uploadFileToDrive(nomeArquivo, file.type, buffer);

  const id = await appendAtestado({
    cpf: session.user.cpf,
    nomeOriginal: file.name,
    nomeArquivo,
    googleDriveId: fileId,
    dataEnvio: new Date().toISOString(),
    dataAtestado,
    status: 'Pendente',
  });

  return NextResponse.json({ ok: true, id });
}
