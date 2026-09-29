// 코드로 작성한 오리지널 픽셀 아트. 각 문자는 palette.ts의 색이며 '.'은 투명.
// 외곽선은 빌드 시 자동으로 1px 둘러진다(outline: false 제외).
import { PAL } from './palette';

export interface SpriteDef {
  rows: string[];
  outline?: boolean;
}

const S = (s: string, outline = true): SpriteDef => ({ rows: s.trim().split('\n').map((r) => r.trim()), outline });

export const JUNK_SPRITES: Record<string, SpriteDef> = {
  crate: S(`
    55555555555555
    z6444444444z6z
    z333333333333z
    55555555555555
    z444444444444z
    z333333333333z
    55555555555555
    z6444444444z6z
    z333333333333z
    zzzzzzzzzzzzzz`),
  drawer: S(`
    44444444444444444444
    5555555555555555555z
    z444444444444444444z
    z44444444bb44444444z
    z333333333333333333z
    zzzzzzzzzzzzzzzzzzzz
    z444444444444444444z
    z44444444bb44444444z
    z333333333333333333z
    zzzzzzzzzzzzzzzzzzzz
    z444444444444444444z
    z44444444bb44444444z
    z333333333333333333z
    zzzzzzzzzzzzzzzzzzzz
    .zz..............zz.`),
  bottle: S(`
    ..ff..
    ..ed..
    ..dd..
    .dddd.
    ddfddd
    cdfddd
    cdfddd
    cddddd
    cddfdd
    ccdddd
    .cccc.`),
  bulb: S(`
    .eeee.
    evwwve
    evwbve
    evbvve
    evvvve
    .eeee.
    .klkl.
    .lklk.
    ..kk..`),
  rag: S(`
    ...rrrrr.....
    .rrsrrrqrr...
    rrqrrsrrrqr..
    rsrrrqrrsrrr.
    qrrqrsrrrqrrr
    qqrrrrqrsrrqr
    .qqrrrrqrrqq.
    ...qqqqqqq...`),
  can: S(`
    lmmmmmmmlk
    kkkkkkkkkj
    lmlkkkkkkj
    lm88888kkj
    lm89998kkj
    lm88888kkj
    lmlkkkkkkj
    lmlkkkkkkj
    kkkkkkkkkj
    .jjjjjjjj.`),
  paper: S(`
    .77777787776.
    77lll7l8ll776
    777777787776.
    7ll7ll787ll76
    777777787776.
    7lll7l78lll76
    777777787776.
    66666666666..`),
  teddy: S(`
    .33......33.
    3443....3443
    344333333443
    .3444444443.
    .3414444143.
    .3444664443.
    ..34461443..
    ..33444433..
    .3344444433.
    344344443443
    344444444443
    .3443..3443.
    ..33....33..`),
  purse: S(`
    ...bb....
    ..b..b...
    .qqqqqqq.
    qqrrrrrqq
    qrrbbbrrq
    qrrrrrrrq
    qqrrrrrqq
    .qqqqqqq.`),
  starbit: S(`
    ....v....
    ...vwv...
    vvvvwvvvv
    .vvwwwvv.
    ..vwwwv..
    .vvvwvvv.
    .vv...vv.`),
  chain: S(`
    ..llll..llll..
    .l....ll....l.
    .k.kk.kk.kk.k.
    ..kk..kk..kk..
    .llll.llll.ll.
    l....l....l..l
    k.kk.k.kk.k.kk
    .kk...kk...kk.`),
  plate: S(`
    ..llllllllllll..
    .lmmmmmmmmmmmlk.
    lmkmmmmmmmmmkmlk
    lmmmmmmmmmmmmmlk
    lmmmmlmmmmmmmmlk
    lmkmmmmmmmmmkmlk
    .kllllllllllllk.
    ..kkkkkkkkkkkk..`),
  safe: S(`
    jjjjjjjjjjjjjjjjjj
    jmmmmmmmmmmmmmmmlj
    jmkkkkkkkkkkkkkklj
    jmkjjjjjjjjjjjjklj
    jmkjjjjlllljjjjklj
    jmkjjjlkbbkljjjklj
    jmkjjjlbkkbljjbklj
    jmkjjjlbkkbljjbklj
    jmkjjjlkbbkljjjklj
    jmkjjjjlllljjjjklj
    jmkjjjjjjjjjjjjklj
    jmkkkkkkkkkkkkkklj
    jllllllllllllllllj
    .jj............jj.`),
  net: S(`
    ..t.t.t.t.t....
    .tututututut...
    tuttuttuttutt..
    .ututututututu.
    tuttuttuttuttut
    .utututututut..
    ..ttuttuttutt..
    ...ututututu...`),
  buoy: S(`
    ...eeeeee...
    ..effffeee..
    .efdddddded.
    edddcdddddde
    edcdddddcdde
    dddddcdddddd
    dcddddddcddd
    .dddcdddddd.
    .cdddddddcd.
    ..ccddddcc..
    ...cccccc...`),
  lantern: S(`
    ...kkkk...
    ..k....k..
    .jjjjjjjj.
    .jevwwvej.
    .jevvvvej.
    .jebvvbej.
    .jevvvvej.
    .jjjjjjjj.
    ..kkkkkk..`),
  seachest: S(`
    .44444444444444.
    4555555555555554
    4k444444444444k4
    4k333333333333k4
    kkkkkkkbbkkkkkkk
    4k444444bb4444k4
    4k444444444444k4
    4k333333333333k4
    .33333333333333.`),
  pot: S(`
    ....h.h.....
    .....hh.....
    .cccccccccc.
    ddddddddddde
    .dcccccccce.
    .ddddddddde.
    .dddfddddde.
    ..ddddddde..
    ..dddfddde..
    ..cddddddc..
    ...cccccc...`),
  pane: S(`
    ffffffffffffff
    feeeeeeefeeeed
    feeeeeefeeeeed
    feeeeefeeeeeed
    feeeefeeeeeeed
    feeefeeeeeeeed
    feefeeeeeeeeed
    fefeeeeeeeeeed
    dddddddddddddd`),
  belljar: S(`
    .....ddd.....
    ....deffd....
    ...deeeeed...
    ..deeeeefed..
    ..deeeueeed..
    ..deeuuueed..
    ..deeeueeed..
    ..deeehheed..
    ..deeeheeed..
    ..ddddddddd..
    .zzzzzzzzzzz.
    .33333333333.`),
  wcan: S(`
    .......kkk...
    ......k...k..
    .lllllllll.k.
    lmmmmmmmmlk.k
    lmllllllmlk..
    lmllllllmlkkk
    lmllllllmlk.k
    lmllllllmlk..
    lmmmmmmmmlk..
    .kkkkkkkkk...`),
  planter: S(`
    ..h..i....h..i....
    .hih.hi..hih.ih...
    ..h...h...h...h...
    444444444444444444
    555555555555555555
    z4444444444444444z
    z4444444444444444z
    z3333333333333333z
    zzzzzzzzzzzzzzzzzz`),
  seedbag: S(`
    ...r.r....
    ...rrr....
    ..ssrss...
    .rrrrrrr..
    rrsrrrrsr.
    rrrrhrrrr.
    rsrrhhrrrr
    rrrrrrrsrr
    .rrrrrrrr.
    ..rrrrrr..`),
  lampglass: S(`
    ..kk..
    .kkkk.
    .evve.
    evwwve
    evwwve
    evvvve
    .eeee.`),
  windup: S(`
    ....bb.....
    ....ab.....
    ...bbbb....
    .aaaaaaaa..
    abbbbbbbba.
    ab1bbbb1ba.
    abbbyybbba.
    abbbbbbbba.
    .aaaaaaaa..
    .y.y..y.y..`),
  cuckoo: S(`
    ......33......
    .....3443.....
    ....344443....
    ...34444443...
    ..3444444443..
    .333333333333.
    ..4bbbbbbbb4..
    ..4b777777b4..
    ..4b771777b4..
    ..4b777177b4..
    ..4b777777b4..
    ..4bbbbbbbb4..
    ..4444444444..
    ..4z..aa..z4..
    ......aa......
    ......bb......
    .....bbbb.....`),
  gearbox: S(`
    jjjjjjjjjjjjjj
    jlllllllllllkj
    jllkkbbbbkklkj
    jllkbbaabbklkj
    jllbbakkabblkj
    jllbbakkabblkj
    jllkbbaabbklkj
    jllkkbbbbkklkj
    jlllllllllllkj
    jkkkkkkkkkkkkj
    jjjjjjjjjjjjjj`),
  trunk: S(`
    .333333333333333333333.
    34444444444444444444443
    34555555555555555555543
    34444xx444444444xx44443
    3333xbbx3333333xbbx3333
    34444xx444444444xx44443
    34444xx444bbb444xx44443
    34444xx444b1b444xx44443
    34444xx444444444xx44443
    34444xx444444444xx44443
    33333xx333333333xx33333
    .zzzzzzzzzzzzzzzzzzzzz.`),
  musicbox: S(`
    .....u.......
    ....uuu......
    .....u.......
    aaaaaaaaaaaa.
    abbbbbbbbbba.
    ab7bbbbbb7ba.
    abbbbyybbbbak
    abbbbbbbbbbak
    aaaaaaaaaaaa.`),
  frame: S(`
    55555555555555
    5444444444444z
    54oooooooooo4z
    54oooo66oooo4z
    54ooo6666ooo4z
    54ooo6116ooo4z
    54oooo66oooo4z
    54ooo8888ooo4z
    54oo888888oo4z
    54oo888888oo4z
    54444444444444
    5zzzzzzzzzzzzz`),
  starshard: S(`
    ....w.....
    ...wvw....
    ...vvv....
    ..wvvvw...
    ..vvwvv...
    .wvvvvvw..
    .vvvwvvv..
    ..vvvvv...
    ...vbv....
    ....b.....`),
  meteor: S(`
    ......1111111.......
    ....11222222211.....
    ...1222v22222221....
    ..122222v2222v221...
    .12222222v22v22221..
    .1222v2222vv222221..
    122222v2222222v2221.
    12222222v222222v221.
    1222vv22v2222222221.
    12222222vv22v222221.
    .122v222222v222221..
    .12222v22222222221..
    ..122222222v22221...
    ...1122222222211....
    .....111111111......`),
  slag: S(`
    ....kkkkk.....
    ..kklllllkk...
    .klmmmlllllk..
    klmmllaallllk.
    kllllaayallllk
    klllllaallllk.
    .kkllllllllkk.
    ...kkkkkkkk...`),
  glassrock: S(`
    ...dddd.....
    ..deeefd....
    .deeeeefdd..
    deecceeeeed.
    deeeecceeeed
    .dceeeeecced
    .ddceeeeeed.
    ..dddccddd..`),
  charcrate: S(`
    33333333333333
    2222222222a222
    2333a333333332
    33333333333333
    2222222222222a
    2333333a333332
    33333333333333
    2a22222222222a
    2333333333a332
    22222222222222`),
  starclock: S(`
    ...bbbbbb...
    ..bvvvvvvb..
    .bvvvwvvvvb.
    bvvvvwvvvvvb
    bvvvvwvvvvvb
    bvvvvwwwwvvb
    bvvvvvvvvvvb
    bvvvvvvvvvvb
    .bvvvvvvvvb.
    ..bbbbbbbb..
    ....a..a....`),
};

export const TOOL_SPRITES: Record<string, SpriteDef> = {
  mallet: S(`
    .....z4......
    .....z4......
    .....z4......
    .....z4......
    .....z4......
    .....z4......
    ..333333333..
    .34444444443.
    .35555555553.
    .34444444443.
    .33333333333.`),
  crowbar: S(`
    ..89..
    ..89..
    ..89..
    ..89..
    ..89..
    ..89..
    ..89..
    ..89..
    ..899.
    ..8899
    ...889
    ....89`),
  poker: S(`
    .kkk.
    k...k
    .kkk.
    ..k..
    ..k..
    ..k..
    ..k..
    ..k..
    ..j..
    ..a..
    .a9a.
    ..9..`),
  magnet: S(`
    ...888888...
    ..89999998..
    .8998888998.
    .898....898.
    .898....898.
    .898....898.
    .898....898.
    .lml....lml.
    .lml....lml.
    .kkk....kkk.`),
  fork: S(`
    ..kkk..
    ...k...
    ...k...
    ...l...
    ...l...
    ..lll..
    .lm.ml.
    .l...l.
    .l...l.
    .m...m.
    .l...l.
    .l...l.`),
  key: S(`
    .bbb..bbb.
    baab..baab
    baaabbaaab
    baab..baab
    .bbb..bbb.
    ....ab....
    ....ab....
    ....ab....
    ....ab....
    ...aab....
    ....ab....
    ...aab....`),
  star: S(`
    .....tu......
    .....tu......
    .....tu......
    .....tu......
    .....tu......
    ..vvvvvvvvv..
    .vwwwwwwwwwv.
    .vwbbwwwbbwv.
    .vwwwwwwwwwv.
    ..vvvvvvvvv..`),
};

export const MACHINE_SPRITES: Record<string, SpriteDef> = {
  thumper: S(`
    .jjjjjjjjjjjj.
    jkkkkkkkkkkkkj
    jkllllllllllkj
    jkl88888888lkj
    jkllllllllllkj
    jkkkkkkkkkkkkj
    .jjjjjjjjjjjj.
    ....jkllkj....`),
  thumperHead: S(`
    .kkkkkkkkkk.
    kllllllllllk
    kmmmmmmmmmmk
    kllllllllllk
    .kkkkkkkkkk.`),
  magnetpole: S(`
    ...jjjj...
    ...kllk...
    ...kllk...
    .88888888.
    8899999988
    898....898
    898....898
    lml....lml`),
  brazier: S(`
    .a..9..a....
    .9a.a9.9a...
    ..9aba9a....
    jjjjjjjjjjjj
    .jkkkkkkkkj.
    ..jkkkkkkj..
    ...jjjjjj...`),
  bell: S(`
    .....jj.....
    .....kk.....
    ....bbbb....
    ...baaaab...
    ..baaaaaab..
    ..baaaaaab..
    .baaaaaaaab.
    .baaaaaaaab.
    bbbbbbbbbbbb
    .....yy.....`),
  winder: S(`
    ..bbb..bbb..
    .baab..baab.
    .baaabbaaab.
    .baab..baab.
    ..bbb..bbb..
    .....ab.....
    ..jjjjjjjj..
    ..jkkkkkkj..
    ..jjjjjjjj..`),
  antenna: S(`
    .....vw.....
    ....vwwv....
    .....vv.....
    .....kk.....
    ..k..kk..k..
    ...k.kk.k...
    ....kkkk....
    .....kk.....
    ....jjjj....`),
};

export const CURIO_SPRITES: Record<string, SpriteDef> = {
  purse: S(`
    ...bbb....
    ..b...b...
    .qqqqqqqq.
    qrrrrrrrrq
    qrrbbbbrrq
    qrrbwwbrrq
    qrrbbbbrrq
    qrrrrrrrrq
    .qqqqqqqq.`),
  falsebottom: S(`
    5555555555
    z44444444z
    z44444444z
    z33333333z
    zzzzzzzzzz
    zbbbbbbbbz
    zbvbbbbvbz
    zzzzzzzzzz`),
  marbles: S(`
    ....tt....
    ...tuut...
    ..tuuuut..
    .tudddeut.
    .tdefd8dt.
    .td8ddefd.
    ..tdddddt.
    ...tttttt.`),
  glove: S(`
    .5.5.5....
    .5.5.5.5..
    .555555.5.
    .5555555..
    45555555..
    445555554.
    .44555554.
    ..4444444.
    ..333333..`),
  crowfeather: S(`
    ........01
    .......011
    ......0o1.
    .....0o1..
    ....0o1...
    ...0o1....
    ..0o1.....
    .0o1......
    .k........`),
  duster: S(`
    .ss.ss.ss.
    srsrsrsrs.
    .srsrsrs..
    ..srsrs...
    ...444....
    ...444....
    ....4.....
    ....3.....
    ....3.....`),
  matchbox: S(`
    ......8...
    ......4...
    .....84...
    ....84....
    8888888888
    8777777778
    8779797778
    8777777778
    8888888888`),
  coil: S(`
    .yyyyyyyy.
    yx......xy
    .yyyyyyyy.
    yx......xy
    .yyyyyyyy.
    yx......xy
    .yyyyyyyy.
    ....kk....`),
  wetrope: S(`
    ..5555....
    .5....5...
    5..dd..5..
    5.d..d.5..
    .5....5...
    ..5555....
    .....5....
    ......5.d.
    .......5..`),
  anchor: S(`
    ....kk....
    ...k..k...
    ....kk....
    .kkkkkkkk.
    ....kk....
    ....kk....
    k...kk...k
    kk..kk..kk
    .kkkkkkkk.
    ...kkkk...`),
  lens: S(`
    ...kkkk...
    ..keeeek..
    .kefffeek.
    .kefeeeek.
    .keeeevek.
    .keeevvek.
    ..keeeek..
    ...kkkk...`),
  compass: S(`
    ...bbbb...
    ..b7777b..
    .b777877b.
    .b778877b.
    .b77kk77b.
    .b77ll77b.
    .b777l77b.
    ..b7777b..
    ...bbbb...`),
  dewdrop: S(`
    ....d.....
    ...dd.....
    ..ddfd....
    .ddffdd...
    .dfddddd..
    .ddddddd..
    ..ddddd...
    ...ccc....`),
  prism: S(`
    ....f.....
    ...fef....
    ...efe....
    ..feeef...
    ..eeeee...
    .feeeeef..
    .eeeeeee..
    ffffffff8a
    .......hbo`),
  butterfly: S(`
    .uu....uu.
    uttu..uttu
    utbtuutbtu
    uttt11tttu
    .uut11tuu.
    .uttu1tuu.
    utbt..tbtu
    .uu....uu.`),
  moss: S(`
    ..hhii....
    .hhhhih...
    hhkhhhhh..
    klkkhkkhh.
    kllkkllkk.
    kkllkkllk.
    .kkkkkkk..`),
  bellows: S(`
    ..4444....
    .455554...
    45555554..
    z3333333k.
    zzzzzzzzkk
    z3333333k.
    45555554..
    .455554...
    ..4444....`),
  cuckoofeather: S(`
    ........b.
    .......bb.
    ......bab.
    .....bab..
    ....bab...
    ...bab....
    ..bab.....
    .bab......
    .y........`),
  gearnecklace: S(`
    ..k....k..
    ...k..k...
    ....kk....
    ...bbbb...
    ..baaaab..
    .bbakkabb.
    .bbakkabb.
    ..baaaab..
    ...bbbb...`),
  pocketwatch: S(`
    ....b.....
    ...bbb....
    .bbbbbbb..
    b7777777b.
    b7771777b.
    b7771117b.
    b7777777b.
    b7777777b.
    .bbbbbbb..`),
  sheetmusic: S(`
    7777777777
    7111111117
    7777707777
    7111101117
    7770007777
    7110001117
    7777777777
    7111111117
    6666666666`),
  loupe: S(`
    ..kkkk....
    .keeeek...
    keef.eek..
    keeee.ek..
    keee.eek..
    .keeeek...
    ..kkkk4...
    ......44..
    .......44.`),
  stardust: S(`
    ...kkk....
    ...ele....
    ..e....e..
    .evwvvwve.
    .evvwvvve.
    .ewvvvwve.
    .evvvwvve.
    ..eeeeee..`),
  meteorite: S(`
    ...1111...
    ..12222v..
    .122v2221.
    .12222v21.
    .1v222221.
    ..12v221..
    ...1111...`),
  lodestone: S(`
    ...jjjj...
    ..jkkkkj..
    .jk8kkkkj.
    .jkkkk8kj.
    .jk88kkkj.
    .jkkkkkkj.
    ..jjjjjj..`),
  stareye: S(`
    ...vvvv...
    ..vwwwwv..
    .vwwoowwv.
    vwwonnowwv
    vwwonnowwv
    .vwwoowwv.
    ..vwwwwv..
    ...vvvv...`),
  endless: S(`
    ..bbbbbb..
    .b......b.
    ..bbbbbb..
    .b......b.
    ..bbbbbb..
    .b......b.
    ..bbbbbb..
    ....aa....`),
  crown: S(`
    b..b..b..b
    bb.bb.bb.b
    bbbbbbbbbb
    b8bbvbb8bb
    bbbbbbbbbb
    aaaaaaaaaa`),
};

export const MISC_SPRITES: Record<string, SpriteDef> = {
  keeper: S(`
    ....222222....
    ...22222222...
    ..2222222222..
    ..2bb2222bb2..
    ..2266666622..
    ..2661661662..
    ..2666666662..
    ...66669666...
    ....666666....
    ...oooooooo...
    ..oo555555oo..
    .6oo555555oo6.
    .6.o555555o.6.
    ...o555555o...
    ...o555555o...
    ....555555....
    ....33..33....
    ....33..33....
    ...333..333...`),
  keeperCheer: S(`
    6............6
    6...222222...6
    .6.22222222.6.
    .62222222222 6
    ..2bb2222bb2..
    ..2266666622..
    ..2661661662..
    ..2666666662..
    ...66699666...
    ....666666....
    ...oooooooo...
    ..oo555555oo..
    ...o555555o...
    ...o555555o...
    ...o555555o...
    ....555555....
    ....33..33....
    ....33..33....
    ...333..333...`),
  magpie: S(`
    .......11...
    ......1111..
    .....11w1a..
    1....1111...
    11..1wwww1..
    .11oooow1...
    ..1ooo1111..
    ...1..1.....`),
  magpieFly: S(`
    .oo.........
    ..ooo..11...
    ...oo.1111..
    1...o11w1a..
    11..1wwww1..
    .11111ww1...
    ....1111....`),
  cart: S(`
    444444444444444444444444444444
    555555555555555555555555555555
    z4444444444444444444444444444z
    z3333333333333333333333333333z
    z4444444444444444444444444444z
    z3333333333333333333333333333z
    zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz`),
  wheel0: S(`
    .jjjj.
    jkllkj
    jlkklj
    jlkklj
    jkllkj
    .jjjj.`),
  wheel1: S(`
    .jjjj.
    jlkklj
    jkllkj
    jkllkj
    jlkklj
    .jjjj.`),
  flame0: S(`
    ..a...
    .aba..
    .abva.
    abvvba
    .9aa9.`, false),
  flame1: S(`
    ...a..
    ..aba.
    .avba.
    abvvba
    .9aa9.`, false),
  coin: S(`
    .bb.
    bvab
    bbab
    .aa.`),
  starcore: S(`
    ......v......
    ......v......
    .....vwv.....
    .....vwv.....
    ....vwwwv....
    vvvvwwwwwvvvv
    .vvwwwwwwwvv.
    ..vvwwwwwvv..
    ...vwwwwwv...
    ..vwwvvvwwv..
    ..vwv...vwv..
    .vwv.....vwv.
    .vv.......vv.`),
  mote: S(`
    .v.
    vwv
    .v.`, false),
};

// ---------- 빌더 ----------
export interface Built {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

function parse(def: SpriteDef) {
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const grid: (string | null)[][] = [];
  for (let y = 0; y < h; y++) {
    const row: (string | null)[] = [];
    for (let x = 0; x < w; x++) {
      const ch = def.rows[y][x] ?? '.';
      row.push(ch === '.' || ch === ' ' || !PAL[ch] ? null : ch);
    }
    grid.push(row);
  }
  return { w, h, grid };
}

export function toGrid(def: SpriteDef): (string | null)[][] {
  const { w, h, grid } = parse(def);
  if (def.outline === false) return grid;
  const out: (string | null)[][] = [];
  for (let y = 0; y < h + 2; y++) {
    const row: (string | null)[] = [];
    for (let x = 0; x < w + 2; x++) {
      const c = grid[y - 1]?.[x - 1] ?? null;
      if (c) row.push(c);
      else {
        const n = [grid[y - 2]?.[x - 1], grid[y]?.[x - 1], grid[y - 1]?.[x - 2], grid[y - 1]?.[x]].some((v) => v);
        row.push(n ? '0' : null);
      }
    }
    out.push(row);
  }
  return out;
}

export function gridToCanvas(grid: (string | null)[][], map?: (c: string, x: number, y: number) => string | null): HTMLCanvasElement {
  const h = grid.length;
  const w = grid[0]?.length ?? 1;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c = grid[y][x];
      if (!c) continue;
      if (map) c = map(c, x, y);
      if (!c) continue;
      ctx.fillStyle = c.startsWith('#') ? c : PAL[c];
      ctx.fillRect(x, y, 1, 1);
    }
  return cv;
}

// 반짝이(황금) 변형: 밝기에 따라 금색 계열로 치환
const GOLD = ['x', 'a', 'b', 'v', 'w'];
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255;
}
export function goldMap(c: string) {
  if (c === '0') return '0';
  const l = lum(PAL[c]);
  return GOLD[Math.min(GOLD.length - 1, Math.floor(l * GOLD.length))];
}

// 금 간 자국: 불투명 픽셀 안에서 시드 고정 랜덤 워크
export function crackGrid(grid: (string | null)[][], seed: number, stage: number) {
  const h = grid.length;
  const w = grid[0].length;
  const out: (string | null)[][] = grid.map((r) => r.map(() => null));
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const inside = (x: number, y: number) => grid[y]?.[x] && grid[y][x] !== '0';
  const walks = stage === 1 ? 1 : 3;
  for (let k = 0; k < walks; k++) {
    let x = Math.floor(w / 2 + (rnd() - 0.5) * w * 0.5);
    let y = Math.floor(h / 2 + (rnd() - 0.5) * h * 0.5);
    const len = Math.floor((w + h) * (stage === 1 ? 0.35 : 0.45));
    for (let i = 0; i < len; i++) {
      if (inside(x, y)) out[y][x] = '1';
      const r = rnd();
      if (r < 0.35) x++;
      else if (r < 0.7) x--;
      if (rnd() < 0.6) y += rnd() < 0.5 ? 1 : -1;
    }
  }
  return out;
}
