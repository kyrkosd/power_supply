import { DesignSpec, DesignResult } from '../topologies/types';

export function generateBuckNetlist(spec: DesignSpec, result: DesignResult): string {
  const { vin_nom, vout, fsw, iout_max } = spec;
  const { inductor, output_cap, mosfet, diode } = result;

  const rload = vout / iout_max;
  const t = 1 / fsw;
  const ton = result.duty_cycle * t;
  const tstop = 20 * t;
  const tsave = 15 * t;

  const L = inductor.value;
  const DCR = inductor.rms_current ? 0.01 : 0.01; // Default to 10mΩ if not strictly modeled
  const C = output_cap.effective_value || output_cap.value;
  const ESR = output_cap.esr_max;
  const Rdson = mosfet.rds_on_max;
  const Vf = diode.vr_max ? 0.5 : 0.5; // Generic Schottky Vf

  // We use node FLAGs as virtual wires so the schematic visually isn't cluttered
  // but perfectly routes the connections for LTspice's SPICE engine.
  const ascContent = `Version 4
SHEET 1 1140 708
FLAG -128 80 VIN
FLAG -128 160 0
FLAG -64 80 GATE
FLAG -64 160 SW
FLAG 48 0 VIN
FLAG 48 80 SW
FLAG 16 16 GATE
FLAG 16 64 SW
FLAG 128 160 0
FLAG 128 96 SW
FLAG 144 0 SW
FLAG 224 0 VOUT
FLAG 240 48 VOUT
FLAG 240 112 0
FLAG 336 32 VOUT
FLAG 336 112 0
SYMBOL voltage -128 80 R0
SYMATTR InstName V1
SYMATTR Value {Vin}
SYMBOL voltage -64 80 R0
SYMATTR InstName V2
SYMATTR Value PULSE(0 5 0 1n 1n {Ton} {T})
SYMBOL sw 48 0 R0
SYMATTR InstName S1
SYMATTR Value MYSW
SYMBOL diode 128 160 R180
SYMATTR InstName D1
SYMATTR Value MYDIODE
SYMBOL ind 144 0 R90
SYMATTR InstName L1
SYMATTR Value {L}
SYMATTR SpiceLine Rser={DCR}
SYMBOL cap 240 48 R0
SYMATTR InstName C1
SYMATTR Value {C}
SYMATTR SpiceLine Rser={ESR}
SYMBOL res 336 32 R0
SYMATTR InstName R1
SYMATTR Value {Rload}
TEXT -128 240 Left 2 !.tran 0 {Tstop} {Tsave}
TEXT -128 272 Left 2 !.model MYSW SW(Ron={Rdson} Roff=1Meg Vt=2.5 Vh=0)
TEXT -128 304 Left 2 !.model MYDIODE D(Vf={Vf} Ron=0.02)
TEXT -128 336 Left 2 !.param Vin=${vin_nom} Ton=${ton} T=${t} L=${L} C=${C} Rload=${rload} Rdson=${Rdson} Vf=${Vf} DCR=${DCR} ESR=${ESR} Tstop=${tstop} Tsave=${tsave}
TEXT -128 368 Left 2 !.meas tran Vout_avg avg V(VOUT)
TEXT -128 400 Left 2 !.meas tran Vout_pk max V(VOUT)
TEXT -128 432 Left 2 !.meas tran Vout_min min V(VOUT)
TEXT -128 464 Left 2 !.meas tran Vout_ripple param Vout_pk-Vout_min
TEXT -128 496 Left 2 !.meas tran Iin_avg avg -I(V1)
TEXT -128 528 Left 2 !.meas tran Iout_avg avg I(R1)
TEXT -128 560 Left 2 !.meas tran Efficiency param (Vout_avg*Iout_avg)/(Vin*Iin_avg+1u)
TEXT -128 592 Left 2 !.meas tran IL_peak max I(L1)`;

  return ascContent;
}