import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, CloudSun, MoveHorizontal, Compass, Flashlight, Ruler,
  Calculator, ArrowLeftRight, Gauge, MapPin, CircleDot, X, ChevronRight,
} from 'lucide-react';
import GradientFieldHeader from '@/components/field/GradientFieldHeader';
import { staggerContainer, slideUp } from '@/lib/fieldAnimations';
import WeatherTool from '@/components/field/tools/WeatherTool';
import SpiritLevelTool from '@/components/field/tools/SpiritLevelTool';
import CompassTool from '@/components/field/tools/CompassTool';
import FlashlightTool from '@/components/field/tools/FlashlightTool';
import RulerTool from '@/components/field/tools/RulerTool';
import CalculatorTool from '@/components/field/tools/CalculatorTool';
import UnitConverterTool from '@/components/field/tools/UnitConverterTool';
import ClinometerTool from '@/components/field/tools/ClinometerTool';
import GpsCoordinatesTool from '@/components/field/tools/GpsCoordinatesTool';
import BubbleLevelTool from '@/components/field/tools/BubbleLevelTool';

const TOOLS = [
  { id: 'weather', label: 'Weather', desc: 'Live conditions & forecast', icon: CloudSun, gradient: 'stat-gradient-sky', Component: WeatherTool },
  { id: 'spirit-level', label: 'Spirit Level', desc: 'Check surface tilt', icon: MoveHorizontal, gradient: 'stat-gradient-emerald', Component: SpiritLevelTool },
  { id: 'compass', label: 'Compass', desc: 'Find your bearing', icon: Compass, gradient: 'stat-gradient-rose', Component: CompassTool },
  { id: 'flashlight', label: 'Flashlight', desc: 'Toggle your torch', icon: Flashlight, gradient: 'stat-gradient-amber', Component: FlashlightTool },
  { id: 'ruler', label: 'Ruler', desc: 'Quick measurements', icon: Ruler, gradient: 'stat-gradient-violet', Component: RulerTool },
  { id: 'calculator', label: 'Calculator', desc: 'Crunch the numbers', icon: Calculator, gradient: 'stat-gradient-slate', Component: CalculatorTool },
  { id: 'converter', label: 'Unit Converter', desc: 'mm/inch, °C/°F & more', icon: ArrowLeftRight, gradient: 'stat-gradient-cyan', Component: UnitConverterTool },
  { id: 'clinometer', label: 'Clinometer', desc: 'Measure angles & slope', icon: Gauge, gradient: 'stat-gradient-orange', Component: ClinometerTool },
  { id: 'gps', label: 'GPS Coordinates', desc: 'Live lat / lng', icon: MapPin, gradient: 'stat-gradient-indigo', Component: GpsCoordinatesTool },
  { id: 'bubble-level', label: 'Bubble Level', desc: 'Dual-axis levelling', icon: CircleDot, gradient: 'stat-gradient-teal', Component: BubbleLevelTool },
];

export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState(null);
  const ActiveComponent = TOOLS.find(t => t.id === activeTool)?.Component;

  return (
    <div className="min-h-full">
      <AnimatePresence mode="wait">
        {ActiveComponent ? (
          <motion.div
            key="tool"
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-0 z-50 field-bg overflow-y-auto mobile-app-content safe-area-top"
          >
            <ActiveComponent onClose={() => setActiveTool(null)} />
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 space-y-4"
          >
            <GradientFieldHeader
              title="Field Tools"
              subtitle="Pro surveyor kit — 10 tools"
              icon={Wrench}
            />

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-3"
            >
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <motion.button
                    key={tool.id}
                    variants={slideUp}
                    whileTap={{ scale: 0.94 }}
                    whileHover={{ scale: 1.03 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    onClick={() => setActiveTool(tool.id)}
                    className="field-card p-4 flex flex-col items-start gap-2 text-left"
                  >
                    <div className={`w-12 h-12 rounded-2xl ${tool.gradient} flex items-center justify-center shadow-md`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{tool.label}</p>
                      <p className="text-[11px] text-slate-500 leading-tight">{tool.desc}</p>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}