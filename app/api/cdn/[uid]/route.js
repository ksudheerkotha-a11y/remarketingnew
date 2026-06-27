export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const uid = params.uid.replace('.js', '');
  
  // This is the second script that fires after visitor is identified
  // Add your Google/Meta pixel calls here later
  const script = `
(function() {
  var _uid = "${uid}";
  var _ts = ${Date.now()};
  // visitor identified: _uid
  // extend with Google/Meta pixel here
})();
  `.trim();

  return new Response(script, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store',
    }
  });
}
