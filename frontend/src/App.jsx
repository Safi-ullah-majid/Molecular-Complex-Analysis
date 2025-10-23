import React, { useState, useEffect } from 'react';
import { Upload, Play, Download, Settings, AlertCircle, CheckCircle, Loader, Atom, Beaker, FileText, Activity } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

const MolecularAnalyzerGUI = () => {
  const [absorbentFile, setAbsorbentFile] = useState(null);
  const [analyteFile, setAnalyteFile] = useState(null);
  const [absorbentFileId, setAbsorbentFileId] = useState(null);
  const [analyteFileId, setAnalyteFileId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [settings, setSettings] = useState({
    model: 'gemnet_oc',
    device: 'cuda',
    fmax: 0.05,
    steps: 200,
    separation: 3.0,
    method: 'B3LYP',
    basis: '6-31G(d)',
    charge: 0,
    multiplicity: 1
  });

  useEffect(() => {
    if (jobId && isProcessing) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/status/${jobId}`);
          const data = await response.json();
          setJobStatus(data);
          if (data.status === 'completed') {
            setResults(data.results);
            setIsProcessing(false);
            clearInterval(interval);
          } else if (data.status === 'failed') {
            setError(data.error || 'Analysis failed');
            setIsProcessing(false);
            clearInterval(interval);
          }
        } catch (err) {
          setError('Failed to fetch job status');
          setIsProcessing(false);
          clearInterval(interval);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [jobId, isProcessing]);

  const handleFileUpload = async (file, type) => {
    if (!file || !file.name.endsWith('.gjf')) {
      setError('Please upload a valid .gjf file');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      if (type === 'absorbent') {
        setAbsorbentFile(file);
        setAbsorbentFileId(data.file_id);
      } else {
        setAnalyteFile(file);
        setAnalyteFileId(data.file_id);
      }
      setError(null);
    } catch (err) {
      setError(`Failed to upload ${type} file: ${err.message}`);
    }
  };

  const runAnalysis = async () => {
    if (!absorbentFileId || !analyteFileId) {
      setError('Please upload both absorbent and analyte files');
      return;
    }
    setIsProcessing(true);
    setError(null);
    setResults(null);
    setJobStatus(null);
    setActiveTab('results');
    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absorbent_file_id: absorbentFileId,
          analyte_file_id: analyteFileId,
          settings: settings
        })
      });
      if (!response.ok) throw new Error('Failed to start analysis');
      const data = await response.json();
      setJobId(data.job_id);
    } catch (err) {
      setError(`Failed to start analysis: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const downloadFile = async (fileType) => {
    if (!jobId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/download/${jobId}/${fileType}`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileType === 'structure' ? 'optimized_complex.gjf' : 'analysis_results.json';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to download ${fileType}: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                <Atom className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Molecular Complex Analyzer</h1>
                <p className="text-sm text-gray-500">FairChem & GemNet Pipeline</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <div className={`px-3 py-1 rounded-full ${settings.device === 'cuda' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {settings.device.toUpperCase()}
              </div>
              <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                {settings.model}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          {[
            { id: 'upload', label: 'Upload Files', icon: Upload },
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'results', label: 'Results', icon: Activity }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md flex-1 transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={18} />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Beaker className="text-blue-600" size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Absorbent Structure</h3>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer bg-gray-50">
                  <input
                    type="file"
                    accept=".gjf"
                    onChange={(e) => handleFileUpload(e.target.files[0], 'absorbent')}
                    className="hidden"
                    id="absorbent-upload"
                  />
                  <label htmlFor="absorbent-upload" className="cursor-pointer">
                    <Upload className="mx-auto text-gray-400 mb-3" size={32} />
                    {absorbentFile ? (
                      <div className="flex items-center justify-center space-x-2 text-green-600">
                        <CheckCircle size={20} />
                        <span className="font-medium">{absorbentFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 font-medium mb-1">Upload Absorbent .gjf file</p>
                        <p className="text-xs text-gray-500">Click or drag file here</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <Atom className="text-purple-600" size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Analyte Structure</h3>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors cursor-pointer bg-gray-50">
                  <input
                    type="file"
                    accept=".gjf"
                    onChange={(e) => handleFileUpload(e.target.files[0], 'analyte')}
                    className="hidden"
                    id="analyte-upload"
                  />
                  <label htmlFor="analyte-upload" className="cursor-pointer">
                    <Upload className="mx-auto text-gray-400 mb-3" size={32} />
                    {analyteFile ? (
                      <div className="flex items-center justify-center space-x-2 text-green-600">
                        <CheckCircle size={20} />
                        <span className="font-medium">{analyteFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 font-medium mb-1">Upload Analyte .gjf file</p>
                        <p className="text-xs text-gray-500">Click or drag file here</p>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={runAnalysis}
                disabled={!absorbentFileId || !analyteFileId || isProcessing}
                className="flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isProcessing ? (
                  <>
                    <Loader className="animate-spin" size={24} />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Play size={24} />
                    <span>Run Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Analysis Settings</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({...settings, model: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="gemnet_oc">GemNet-OC</option>
                  <option value="gemnet_t">GemNet-T</option>
                  <option value="schnet">SchNet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Device</label>
                <select
                  value={settings.device}
                  onChange={(e) => setSettings({...settings, device: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="cuda">CUDA (GPU)</option>
                  <option value="cpu">CPU</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Force Max (fmax)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.fmax}
                  onChange={(e) => setSettings({...settings, fmax: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Steps</label>
                <input
                  type="number"
                  value={settings.steps}
                  onChange={(e) => setSettings({...settings, steps: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Separation Distance (Å)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.separation}
                  onChange={(e) => setSettings({...settings, separation: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">DFT Method</label>
                <input
                  type="text"
                  value={settings.method}
                  onChange={(e) => setSettings({...settings, method: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-6">
            {isProcessing ? (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-12 text-center">
                <Loader className="animate-spin mx-auto text-blue-500 mb-4" size={48} />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Processing Analysis...</h3>
                {jobStatus && (
                  <div className="mt-4">
                    <div className="w-64 mx-auto bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{width: `${jobStatus.progress || 0}%`}}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600">{jobStatus.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{jobStatus.progress}% complete</p>
                  </div>
                )}
              </div>
            ) : results ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="text-green-500" size={24} />
                    <div>
                      <p className="font-medium text-green-900">Analysis Complete</p>
                      <p className="text-sm text-green-700">Results ready for download</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => downloadFile('results')}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download size={18} />
                      <span>JSON</span>
                    </button>
                    <button
                      onClick={() => downloadFile('structure')}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download size={18} />
                      <span>Structure</span>
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Electronic Properties</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">HOMO-LUMO Gap</p>
                        <p className="text-2xl font-bold text-blue-600">{results.properties?.homo_lumo_gap?.toFixed(2) || 'N/A'} eV</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Dipole Moment</p>
                        <p className="text-2xl font-bold text-blue-600">{results.properties?.dipole_moment?.toFixed(2) || 'N/A'} D</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Energetic Properties</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Total Energy</p>
                        <p className="text-2xl font-bold text-purple-600">{results.properties?.total_energy?.toFixed(2) || 'N/A'} eV</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Binding Energy</p>
                        <p className="text-2xl font-bold text-purple-600">{results.properties?.binding_energy?.toFixed(2) || 'N/A'} kcal/mol</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Structure Info</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Total Atoms</p>
                        <p className="text-2xl font-bold text-indigo-600">{results.structures?.complex_atoms || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-12 text-center">
                <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Results Yet</h3>
                <p className="text-gray-600">Upload files and run analysis to see results</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MolecularAnalyzerGUI;
